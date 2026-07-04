import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Kashier server-to-server webhook.
 * URL ثابت: https://kidzy.life/api/public/kashier/webhook
 *
 * يتحقق من توقيع HMAC-SHA256 للحمولة قبل تحديث حالة الطلب.
 * يخزّن كل callback في payment_logs للتدقيق ومنع التكرار.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-kashier-signature",
} as const;

function verifyKashierSignature(
  data: Record<string, unknown>,
  signature: string,
  secret: string,
): boolean {
  // Kashier signs concatenation of "key=value&" pairs listed in signatureKeys
  const keysRaw = data.signatureKeys;
  const keys = Array.isArray(keysRaw)
    ? (keysRaw as string[])
    : String(keysRaw ?? "")
        .split(",")
        .filter(Boolean);
  if (keys.length === 0) return false;
  const queryString = keys.map((k) => `${k}=${data[k] ?? ""}`).join("&");
  const expected = createHmac("sha256", secret).update(queryString).digest("hex");
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/kashier/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        const secret = process.env.KASHIER_SECRET_KEY;
        if (!secret) {
          return new Response("Kashier not configured", { status: 500, headers: corsHeaders });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Bad JSON", { status: 400, headers: corsHeaders });
        }

        const data = (body.data ?? {}) as Record<string, unknown>;
        const event = String(body.event ?? "");
        const signature = String(data.signature ?? body.signature ?? "");
        const sigOk = signature ? verifyKashierSignature(data, signature, secret) : false;

        const kashierOrderId = String(data.merchantOrderId ?? "");
        const kashierTxId = String(data.transactionId ?? data.kashierOrderId ?? "");
        const status = String(data.status ?? "").toUpperCase();
        const amount = Number(data.amount ?? 0);
        const currency = String(data.currency ?? "EGP");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // always log
        await supabaseAdmin.from("payment_logs").insert({
          provider: "kashier",
          kashier_order_id: kashierOrderId || null,
          kashier_transaction_id: kashierTxId || null,
          event_type: event,
          status,
          amount,
          currency,
          signature_ok: sigOk,
          raw_payload: body as never,
        });

        if (!sigOk) {
          return new Response("Invalid signature", { status: 401, headers: corsHeaders });
        }
        if (!kashierOrderId) {
          return new Response("Missing merchantOrderId", { status: 400, headers: corsHeaders });
        }

        // dedupe: if any order already verified for this kashier_order_id, ack and skip
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status")
          .eq("kashier_order_id", kashierOrderId);

        if (!existing || existing.length === 0) {
          return new Response("Unknown order", { status: 404, headers: corsHeaders });
        }

        const alreadyPaid = existing.every((r) => r.payment_status === "verified");
        if (alreadyPaid) {
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        if (status === "SUCCESS" || status === "PAID" || status === "CAPTURED") {
          const { data: verifiedOrders, error } = await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "verified",
              paid_at: new Date().toISOString(),
              kashier_transaction_id: kashierTxId || null,
              kashier_payload: body as never,
            })
            .eq("kashier_order_id", kashierOrderId)
            .select("user_id");
          if (error) {
            console.error("kashier mark verified failed", error);
            return new Response("DB error", { status: 500, headers: corsHeaders });
          }

          // مكافأة الإحالة (إن وُجدت) بعد أول طلب مؤكَّد — لا تُفشل الويبهوك لو حدث خطأ هنا
          try {
            const { rewardReferralAfterFirstVerifiedOrder } =
              await import("@/features/referrals/referrals.functions");
            const userIds = new Set((verifiedOrders ?? []).map((o) => o.user_id));
            for (const userId of userIds) {
              await rewardReferralAfterFirstVerifiedOrder(userId);
            }
          } catch (e) {
            console.error("rewardReferralAfterFirstVerifiedOrder failed", e);
          }
        } else if (status === "FAILED" || status === "DECLINED" || status === "EXPIRED") {
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "rejected",
              payment_rejection_reason: `Kashier: ${status}`,
              kashier_payload: body as never,
            })
            .eq("kashier_order_id", kashierOrderId)
            .neq("payment_status", "verified");
        }

        return new Response("ok", { status: 200, headers: corsHeaders });
      },
    },
  },
});
