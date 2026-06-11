import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePages, personalize } from "@/lib/storyTypes";

const OrderIdInput = z.object({ orderId: z.string().uuid() });

/** القصة النهائية المخصصة لصاحب الطلب (صفحات + روابط صور موقعة) */
export const getMyStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderIdInput.parse(input))
  .handler(async ({ data, context }) => {
    // RLS يضمن أن المستخدم يرى طلبه فقط (أو المدير)
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, child_name, status, story_templates(title, moral, pages)")
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

    const pages = await Promise.all(
      templatePages.map(async (tp) => {
        const generated = (pageRows ?? []).find((r) => r.page_number === tp.n);
        let imageUrl: string | null = null;
        if (generated?.image_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("story-pages")
            .createSignedUrl(generated.image_path, 3600);
          imageUrl = signed?.signedUrl ?? null;
        }
        return {
          n: tp.n,
          text: generated?.page_text ?? personalize(tp.text, order.child_name),
          imageUrl,
        };
      }),
    );

    return {
      orderId: order.id,
      childName: order.child_name,
      status: order.status as string,
      title: personalize(order.story_templates?.title ?? "", order.child_name),
      moral: order.story_templates?.moral ?? null,
      pages,
    };
  });
