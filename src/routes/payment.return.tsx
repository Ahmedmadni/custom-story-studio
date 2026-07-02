import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * صفحة عودة المستخدم من Kashier. لا تعتمد على query-params للتأكيد —
 * تستعلم من الـ DB (التي يحدّثها webhook) لمعرفة الحالة الحقيقية.
 * تعمل polling كل 2 ثانية لمدة 30 ثانية في حال تأخر الـ webhook.
 */

const Search = z.object({
  orderId: z.string().optional(),
  paymentStatus: z.string().optional(),
  merchantOrderId: z.string().optional(),
});

export const Route = createFileRoute("/payment/return")({
  validateSearch: (s) => Search.parse(s),
  head: () => ({ meta: [{ title: "نتيجة الدفع — كيدزي" }] }),
  component: PaymentReturnPage,
});

type Status = "checking" | "success" | "failed" | "pending";

function PaymentReturnPage() {
  const search = useSearch({ from: "/payment/return" });
  const kashierOrderId = search.merchantOrderId ?? search.orderId ?? "";
  const queryHint = (search.paymentStatus ?? "").toUpperCase();

  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (!kashierOrderId) {
      setStatus(queryHint === "SUCCESS" ? "success" : "failed");
      return;
    }
    let cancelled = false;
    let tries = 0;
    const max = 15;

    const poll = async () => {
      tries++;
      const { data } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("kashier_order_id", kashierOrderId);
      if (cancelled) return;
      if (data && data.length > 0) {
        const allVerified = data.every((r) => r.payment_status === "verified");
        const anyRejected = data.some((r) => r.payment_status === "rejected");
        if (allVerified) return setStatus("success");
        if (anyRejected) return setStatus("failed");
      }
      if (tries >= max) {
        setStatus(queryHint === "SUCCESS" ? "pending" : "failed");
      } else {
        setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [kashierOrderId, queryHint]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-xl px-4 py-20">
        <div className="rounded-3xl border-2 border-border bg-card p-10 text-center shadow-sm">
          {status === "checking" && (
            <>
              <Loader2 className="mx-auto h-14 w-14 animate-spin text-primary" />
              <h1 className="mt-5 font-display text-2xl font-extrabold">جاري تأكيد دفعتك…</h1>
              <p className="mt-2 text-muted-foreground">لحظات من فضلك</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h1 className="mt-5 font-display text-2xl font-extrabold">تم الدفع بنجاح 🎉</h1>
              <p className="mt-2 text-muted-foreground">
                استلمنا طلبك وسنبدأ بإعداد القصة فوراً. سنرسل التفاصيل على واتساب.
              </p>
              <Button asChild className="mt-6 rounded-full font-bold">
                <Link to="/my-orders">عرض طلباتي</Link>
              </Button>
            </>
          )}
          {status === "pending" && (
            <>
              <Loader2 className="mx-auto h-14 w-14 text-amber-500" />
              <h1 className="mt-5 font-display text-2xl font-extrabold">دفعتك قيد المعالجة</h1>
              <p className="mt-2 text-muted-foreground">
                البنك أكّد الدفع لكن لم نستلم إشعار التأكيد بعد. سنحدّث طلبك خلال دقائق.
              </p>
              <Button asChild className="mt-6 rounded-full font-bold">
                <Link to="/my-orders">عرض طلباتي</Link>
              </Button>
            </>
          )}
          {status === "failed" && (
            <>
              <XCircle className="mx-auto h-16 w-16 text-destructive" />
              <h1 className="mt-5 font-display text-2xl font-extrabold">لم تكتمل عملية الدفع</h1>
              <p className="mt-2 text-muted-foreground">
                لم نتلقَّ تأكيدًا للدفع. يمكنك المحاولة مرة أخرى أو اختيار طريقة دفع بديلة.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild className="rounded-full font-bold">
                  <Link to="/cart">العودة للسلة</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full font-bold">
                  <Link to="/contact">تواصل مع الدعم</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
