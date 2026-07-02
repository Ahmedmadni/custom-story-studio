import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { claimReferral } from "@/features/referrals/referrals.functions";

const REF_STORAGE_KEY = "kidzy_ref_code";
const REF_CLAIMED_KEY = "kidzy_ref_claimed";

/**
 * يُثبَّت مرة واحدة في جذر التطبيق (F5). يلتقط ?ref=CODE من الرابط ويحفظه
 * محلياً، ثم يُطالب به تلقائياً أول مرة يظهر فيها مستخدم مسجّل دخوله —
 * بلا حاجة لربطه بخطوة تسجيل محددة (يعمل مع تأكيد البريد المتأخر).
 */
export function ReferralCapture() {
  const { user } = useAuth();
  const claimFn = useServerFn(claimReferral);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && !window.localStorage.getItem(REF_CLAIMED_KEY)) {
      window.localStorage.setItem(REF_STORAGE_KEY, ref.trim().toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const code = window.localStorage.getItem(REF_STORAGE_KEY);
    const claimed = window.localStorage.getItem(REF_CLAIMED_KEY);
    if (!code || claimed) return;

    claimFn({ data: { code } })
      .then((res) => {
        window.localStorage.setItem(REF_CLAIMED_KEY, "1");
        toast.success(`أهلاً بك! خصمك 10% جاهز — الكود: ${res.couponCode}`, { duration: 8000 });
      })
      .catch(() => {
        // فشل متوقع (كود المستخدم نفسه، أو حساب مُحال بالفعل) — لا نزعج المستخدم
        window.localStorage.setItem(REF_CLAIMED_KEY, "1");
      });
  }, [user, claimFn]);

  return null;
}
