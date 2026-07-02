import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** هل أنهى المستخدم أو تخطّى معالج الإعداد الأول (F2)؟ */
export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", context.userId)
      .maybeSingle();
    return { completed: Boolean(data?.onboarding_completed_at) };
  });

/** يُستدعى عند إنهاء المعالج أو تخطّيه — لا يظهر المعالج مجدداً بعدها. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", context.userId);
    if (error) throw new Error("تعذر حفظ حالة الإعداد");
    return { ok: true };
  });
