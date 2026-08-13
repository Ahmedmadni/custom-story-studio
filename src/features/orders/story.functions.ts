import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePages, personalize } from "@/features/ai/storyTypes";

const OrderIdInput = z.object({ orderId: z.string().uuid() });

/** القصة النهائية المخصصة لصاحب الطلب (صفحات + روابط صور موقعة + حالة الاعتماد) */
export const getMyStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: order, error } = await context.supabase
      .from("orders")
      .select(
        "id, child_name, child_name_en, status, template_id, orientation, gifted_by_name, gifted_by_relation, publish_consent, published_to_library_at, story_templates!template_id(id, title, moral, pages, language, content_type, approved_at, admin_approved_at)",
      )
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("الطلب غير موجود");

    const { data: pageRows } = await context.supabase
      .from("generated_pages")
      .select("page_number, image_path, page_text")
      .eq("order_id", data.orderId)
      .order("page_number");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const templatePages = parsePages(order.story_templates?.pages);
    const tpl = order.story_templates as
      | {
          id: string;
          title: string;
          moral?: string | null;
          language?: string | null;
          content_type?: string | null;
          approved_at?: string | null;
          admin_approved_at?: string | null;
        }
      | null;

    const childNameEn =
      (order as { child_name_en?: string | null }).child_name_en?.trim() ||
      order.child_name;

    const pages = await Promise.all(
      templatePages.map(async (tp) => {
        const generated = (pageRows ?? []).find((r) => r.page_number === tp.n);
        const imagePath = generated?.image_path ?? tp.image_path ?? null;
        let imageUrl: string | null = null;
        if (imagePath) {
          const { data: signed } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(imagePath, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return {
          n: tp.n,
          title: tp.title ?? null,
          title_ar: tp.title_ar ?? null,
          title_en: tp.title_en ?? null,
          text:
            generated?.page_text ??
            personalize(
              tp.text ?? "",
              (tpl?.language ?? "ar") === "en" ? childNameEn : order.child_name,
            ),
          text_ar: tp.text_ar ? personalize(tp.text_ar, order.child_name) : null,
          text_en: tp.text_en ? personalize(tp.text_en, childNameEn) : null,
          imageUrl,
        };
      }),
    );

    return {
      orderId: order.id,
      templateId: tpl?.id ?? order.template_id ?? null,
      childName: order.child_name,
      childNameEn,
      status: order.status as string,
      title: personalize(
        tpl?.title ?? "",
        (tpl?.language ?? "ar") === "en" ? childNameEn : order.child_name,
      ),
      moral: tpl?.moral ?? null,
      language: (tpl?.language ?? "ar") as "ar" | "en" | "bilingual",
      contentType: (tpl?.content_type ?? "story") as "story" | "book",
      approvedAt: tpl?.approved_at ?? null,
      adminApprovedAt: tpl?.admin_approved_at ?? null,
      orientation: (((order as { orientation?: string | null }).orientation ?? "landscape") ===
      "portrait"
        ? "portrait"
        : "landscape") as "landscape" | "portrait",
      gifterName: (order as { gifted_by_name?: string | null }).gifted_by_name ?? null,
      gifterRelation: (order as { gifted_by_relation?: string | null }).gifted_by_relation ?? null,
      publishConsent: !!(order as { publish_consent?: boolean }).publish_consent,
      publishedToLibraryAt:
        (order as { published_to_library_at?: string | null }).published_to_library_at ?? null,
      pages,
    };
  });

const ConsentInput = z.object({
  orderId: z.string().uuid(),
  consent: z.boolean(),
});

/** يسمح للعميل بتفعيل/إيقاف موافقته على نشر قصته في «من أعمالنا» */
export const setPublishConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConsentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ publish_consent: data.consent } as never)
      .eq("id", data.orderId)
      .eq("user_id", context.userId);
    if (error) throw new Error("تعذر حفظ موافقة النشر");
    return { ok: true, consent: data.consent };
  });

