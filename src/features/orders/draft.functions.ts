import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRAFT_MAX_BYTES = 50_000;

const DraftPayload = z.record(z.string(), z.unknown());

/** حفظ مسودة معالج الإنشاء (تُستبدل بالكامل في كل مرة) */
export const saveWizardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftPayload.parse(input))
  .handler(async ({ data, context }) => {
    const json = JSON.stringify(data);
    if (json.length > DRAFT_MAX_BYTES) {
      throw new Error("المسودة كبيرة جداً");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("wizard_drafts")
      .upsert(
        {
          user_id: context.userId,
          payload: data as unknown as never,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("save draft", error);
      throw new Error("تعذر حفظ المسودة");
    }
    return { ok: true };
  });

/** قراءة مسودة المستخدم الحالية إن وُجدت */
export const loadWizardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wizard_drafts")
      .select("payload, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

/** حذف مسودة المستخدم (عند انتهاء/تصفير المعالج) */
export const clearWizardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("wizard_drafts")
      .delete()
      .eq("user_id", context.userId);
    return { ok: true };
  });

const _AnyInput = z.unknown();
void _AnyInput;
