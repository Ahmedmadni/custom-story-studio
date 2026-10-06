import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { createHmac } from "node:crypto";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pricePerPages, PRINT_COPY_PRICE_EGP } from "@/features/cart/pricing";
import { orientationFromAspectRatio } from "@/features/ai/storyStyle";

/**
 * Kashier Hosted Payment Page integration.
 * - ينشئ صفوف orders بحالة unpaid + payment_provider='kashier' و kashier_order_id موحّد.
 * - يولّد توقيع HMAC-SHA256 الصحيح ويعيد URL جاهز للتوجيه إلى Kashier.
 * - بعد الدفع، Kashier ستستدعي webhook /api/public/kashier/webhook لتأكيد الطلب.
 */

const ItemInput = z.object({
  templateId: z.string().uuid(),
  childName: z.string().trim().min(1).max(40),
  childNameEn: z.string().trim().max(40).nullable().optional(),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  gender: z.enum(["boy", "girl"]).default("boy"),
  childPhotoPath: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
  language: z.enum(["ar", "en", "bilingual"]).default("ar"),
  photoMode: z.enum(["cartoon", "real"]).default("cartoon"),
  aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("16:9"),
  publishConsent: z.boolean().default(false),
  pagesCount: z.union([z.literal(10), z.literal(16)]).default(10),
  gifterName: z.string().trim().max(60).nullable().optional(),
  gifterRelation: z.string().trim().max(40).nullable().optional(),
});

const Input = z.object({
  whatsapp: z.string().trim().min(8).max(20),
  items: z.array(ItemInput).min(1).max(10),
  printCopy: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(500).nullable().optional(),
});

function kashierHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string) {
  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  return createHmac("sha256", secret).update(path).digest("hex");
}

export const createKashierCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const merchantId = process.env.KASHIER_MERCHANT_ID;
    const secret = process.env.KASHIER_SECRET_KEY;
    const mode = (process.env.KASHIER_MODE ?? "test").toLowerCase() === "live" ? "live" : "test";
    if (!merchantId || !secret) throw new Error("Kashier غير مهيّأ على الخادم");

    if (data.printCopy && !data.deliveryAddress?.trim()) {
      throw new Error("اكتب عنوان التوصيل لطلب نسخة مطبوعة");
    }

    // pricing — same logic as vodafone-cash checkout
    const templateIds = Array.from(new Set(data.items.map((i) => i.templateId)));
    const { data: tplRows, error: templateError } = await context.supabase
      .from("story_templates")
      .select("id, is_custom")
      .in("id", templateIds);
    if (templateError || (tplRows ?? []).length !== templateIds.length) {
      throw new Error("إحدى القصص غير متاحة للطلب");
    }
    const isCustomById = new Map<string, boolean>(
      (tplRows ?? []).map((r) => [
        r.id as string,
        Boolean((r as { is_custom?: boolean }).is_custom),
      ]),
    );

    for (const item of data.items) {
      if (!item.childPhotoPath.startsWith(`${context.userId}/`)) {
        throw new Error("إحدى صور الأطفال لا تخص هذا الحساب");
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const photoNames = data.items.map((item) =>
      item.childPhotoPath.slice(context.userId.length + 1),
    );
    const photoResults = await Promise.all(
      photoNames.map((photoName) =>
        supabaseAdmin.storage
          .from("child-photos")
          .list(context.userId, { limit: 20, search: photoName }),
      ),
    );
    photoResults.forEach((result, index) => {
      const photoName = photoNames[index];
      if (
        result.error ||
        !(result.data ?? []).some((file) => file.name === photoName)
      ) {
        throw new Error("إحدى صور الأطفال غير موجودة أو لا تخص هذا الحساب");
      }
    });

    // Single grouping id used as Kashier merchantOrderId.
    // Use a cryptographically strong identifier rather than Math.random().
    const kashierOrderId = `KZ-${crypto.randomUUID()}`;

    const rows = data.items.map((it, idx) => {
      const isCustom = isCustomById.get(it.templateId) ?? false;
      const base = pricePerPages(it.pagesCount, isCustom);
      const printExtra = data.printCopy && idx === 0 ? PRINT_COPY_PRICE_EGP : 0;
      return {
        user_id: context.userId,
        template_id: it.templateId,
        child_name: it.childName,
        child_name_en: it.childNameEn?.trim() || null,
        child_age: it.childAge ?? null,
        gender: it.gender,
        whatsapp: data.whatsapp,
        child_photo_path: it.childPhotoPath,
        notes: it.notes ?? null,
        payment_status: "unpaid" as const,
        payment_provider: "kashier" as const,
        kashier_order_id: kashierOrderId,
        price_egp: base + printExtra,
        language: it.language,
        photo_mode: it.photoMode,
        aspect_ratio: it.aspectRatio,
        orientation: orientationFromAspectRatio(it.aspectRatio),
        publish_consent: it.publishConsent,
        pages_count: it.pagesCount,
        print_copy: data.printCopy,
        delivery_address: data.printCopy ? data.deliveryAddress?.trim() ?? null : null,
        gifted_by_name: it.gifterName?.trim() || null,
        gifted_by_relation: it.gifterRelation?.trim() || null,
      };
    });

    const totalEgp = rows.reduce((s, r) => s + r.price_egp, 0);
    const amount = totalEgp.toFixed(2);
    const currency = "EGP";

    // Order creation is a trusted server operation. Browser roles intentionally
    // do not have INSERT on orders after least-privilege hardening.
    const { error } = await supabaseAdmin.from("orders").insert(rows);
    if (error) {
      console.error("kashier orders insert failed", error);
      throw new Error("تعذر إنشاء الطلب");
    }

    const hash = kashierHash(merchantId, kashierOrderId, amount, currency, secret);

    const host = getRequestHost() ?? "kidzy.life";
    const proto = host.includes("localhost") ? "http" : "https";
    const origin = `${proto}://${host}`;
    const merchantRedirect = `${origin}/payment/return`;
    const serverWebhook = `${origin}/api/public/kashier/webhook`;

    const params = new URLSearchParams({
      merchantId,
      orderId: kashierOrderId,
      amount,
      currency,
      hash,
      mode,
      merchantRedirect,
      serverWebhook,
      display: "ar",
      type: "external",
      allowedMethods: "card",
    });

    return {
      checkoutUrl: `https://checkout.kashier.io/?${params.toString()}`,
      kashierOrderId,
      amount,
      currency,
    };
  });
