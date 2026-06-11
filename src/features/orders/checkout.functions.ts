import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemInput = z.object({
  templateId: z.string().uuid(),
  childName: z.string().trim().min(1).max(40),
  childAge: z.number().int().min(1).max(14).nullable().optional(),
  childPhotoPath: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
});

const CheckoutInput = z.object({
  whatsapp: z.string().trim().min(8).max(20),
  receiptPath: z.string().min(1),
  items: z.array(ItemInput).min(1).max(10),
});

/**
 * ينشئ صفّ طلب لكل عنصر في السلة بنفس إيصال الدفع.
 * payment_status = receipt_uploaded حتى يؤكدها المدير.
 */
export const submitCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }) => {
    const rows = data.items.map((it) => ({
      user_id: context.userId,
      template_id: it.templateId,
      child_name: it.childName,
      child_age: it.childAge ?? null,
      whatsapp: data.whatsapp,
      child_photo_path: it.childPhotoPath,
      notes: it.notes ?? null,
      receipt_path: data.receiptPath,
      payment_status: "receipt_uploaded" as const,
      price_egp: 100,
      paid_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await context.supabase
      .from("orders")
      .insert(rows)
      .select("id");
    if (error) throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");
    return { ok: true, orderIds: (inserted ?? []).map((r) => r.id) };
  });
