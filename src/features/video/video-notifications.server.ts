import type { VideoEmailTemplate } from "@/features/notifications/videoEmailTemplates";

export async function sendVideoCustomerEmail(params: {
  userId: string;
  template: VideoEmailTemplate;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(params.userId);
    const email = data.user?.email?.trim();
    if (error || !email) {
      console.warn("[video-email] customer email unavailable", {
        userId: params.userId,
        error: error?.message,
      });
      return;
    }

    const { getEmailProvider } =
      await import("@/features/notifications/providers/index.server");
    const result = await getEmailProvider().send({
      to: email,
      subject: params.template.subject,
      html: params.template.html,
    });
    if (!result.ok) {
      console.error("[video-email] send failed", {
        userId: params.userId,
        provider: result.provider,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[video-email] unexpected failure", {
      userId: params.userId,
      error,
    });
  }
}
