import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAGE_PRICES: Record<number, number> = {
  10: 150,
  16: 200,
};
const PRINT_COPY_PRICE = 200;

const ItemInput = z.object({
  templateId: z.string().uuid(),
  childName: z.string().trim().min(1).max(40),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  gender: z.enum(["boy", "girl"]).default("boy"),
  childPhotoPath: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
  language: z.enum(["ar", "en", "bilingual"]).default("ar"),
  photoMode: z.enum(["cartoon", "real"]).default("cartoon"),
  publishConsent: z.boolean().default(false),
  pagesCount: z.union([z.literal(10), z.literal(16)]).default(10),
});

const CheckoutInput = z.object({
  whatsapp: z.string().trim().min(8).max(20),
  receiptPath: z.string().min(1),
  items: z.array(ItemInput).min(1).max(10),
  printCopy: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(500).nullable().optional(),
});

/**
 * ينشئ صفّ طلب لكل عنصر في السلة بنفس إيصال الدفع.
 * payment_status = receipt_uploaded حتى يؤكدها المدير.
 */
export const submitCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.printCopy && !data.deliveryAddress?.trim()) {
      throw new Error("اكتب عنوان التوصيل لطلب نسخة مطبوعة");
    }

    // نضيف رسوم الطباعة + الشحن للعنصر الأول فقط حتى لا تتكرر
    const rows = data.items.map((it, idx) => {
      const base = PAGE_PRICES[it.pagesCount] ?? PAGE_PRICES[10];
      const printExtra = data.printCopy && idx === 0 ? PRINT_COPY_PRICE : 0;
      return {
        user_id: context.userId,
        template_id: it.templateId,
        child_name: it.childName,
        child_age: it.childAge ?? null,
        gender: it.gender,
        whatsapp: data.whatsapp,
        child_photo_path: it.childPhotoPath,
        notes: it.notes ?? null,
        receipt_path: data.receiptPath,
        payment_status: "receipt_uploaded" as const,
        price_egp: base + printExtra,
        paid_at: new Date().toISOString(),
        language: it.language,
        photo_mode: it.photoMode,
        publish_consent: it.publishConsent,
        pages_count: it.pagesCount,
        print_copy: data.printCopy,
        delivery_address: data.printCopy ? data.deliveryAddress?.trim() ?? null : null,
      };
    });

    const { data: inserted, error } = await context.supabase
      .from("orders")
      .insert(rows)
      .select("id");
    if (error) throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");
    return { ok: true, orderIds: (inserted ?? []).map((r) => r.id) };
  });
