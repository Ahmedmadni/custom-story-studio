/**
 * تسجيل إجراءات الأدمن الحسّاسة (منح/سحب الأدوار، تأكيد/رفض الدفع، …) في
 * admin_action_log — سجلّ للقراءة فقط من طرف الأدمن، يُكتب حصرياً عبر
 * service_role هنا. أفضل-جهد (best-effort): فشل التسجيل لا يُسقط الإجراء
 * الأصلي أبداً — نفس نمط try/catch المتّبع مع rewardReferralAfterFirstVerifiedOrder.
 */
export async function logAdminAction(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_action_log").insert({
      actor_id: params.actorId,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: (params.metadata ?? {}) as never,
    });
  } catch (error) {
    console.error("[audit] failed to record admin action", params.action, error);
  }
}
