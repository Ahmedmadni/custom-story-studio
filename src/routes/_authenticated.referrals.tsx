import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Gift, Share2, Users } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyReferralInfo } from "@/features/referrals/referrals.functions";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({ meta: [{ title: "ادعُ صديقاً — كيدزي" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const fetchInfo = useServerFn(getMyReferralInfo);
  const { data: info, isLoading } = useQuery({
    queryKey: ["my-referral-info"],
    queryFn: () => fetchInfo(),
  });

  const link =
    info?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${info.referralCode}`
      : "";

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("تم نسخ رابط الدعوة");
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "كيدزي — قصص مصوّرة لطفلك",
          text: "جرّب كيدزي وأنشئ قصة بطلها طفلك! استخدم رابطي واحصل على خصم 10%:",
          url: link,
        });
      } catch {
        // تجاهل الإلغاء
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-10">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-3xl">
            🎁
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold">ادعُ صديقاً واربحوا معاً</h1>
          <p className="mt-2 text-muted-foreground">
            شارك رابطك — يحصل صديقك على خصم 10% على أول طلب، وتحصل أنت على 100 نقطة بعد إتمامه طلبه
            الأول
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="mt-8 h-40 rounded-3xl" />
        ) : (
          <>
            <div className="mt-8 rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
              <p className="text-xs font-bold text-muted-foreground">رابط دعوتك الخاص</p>
              <p
                dir="ltr"
                className="mt-2 truncate font-display text-lg font-extrabold text-primary"
              >
                {link || "—"}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button className="rounded-full font-bold" onClick={copyLink} disabled={!link}>
                  <Copy className="ms-1 h-4 w-4" />
                  نسخ الرابط
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full font-bold"
                  onClick={shareLink}
                  disabled={!link}
                >
                  <Share2 className="ms-1 h-4 w-4" />
                  مشاركة
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-3xl border-2 border-border bg-card p-4 text-center">
                <Users className="mx-auto h-5 w-5 text-primary" />
                <p className="mt-2 font-display text-xl font-extrabold">
                  {info?.invitedCount ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">صديق انضم برابطك</p>
              </div>
              <div className="rounded-3xl border-2 border-border bg-card p-4 text-center">
                <Users className="mx-auto h-5 w-5 text-grass" />
                <p className="mt-2 font-display text-xl font-extrabold">
                  {info?.rewardedCount ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">أكمل أول طلب</p>
              </div>
              <div className="rounded-3xl border-2 border-border bg-card p-4 text-center">
                <Gift className="mx-auto h-5 w-5 text-accent" />
                <p className="mt-2 font-display text-xl font-extrabold">
                  {info?.pointsFromReferrals ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">نقطة من الإحالات</p>
              </div>
            </div>
            {(info?.invitedCount ?? 0) > (info?.rewardedCount ?? 0) && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {(info?.invitedCount ?? 0) - (info?.rewardedCount ?? 0)} صديق سجّل ولم يكمل طلبه
                الأول بعد — ستحصل على نقاطك بمجرد إتمامه.
              </p>
            )}

            {(info?.invitedCount ?? 0) === 0 && (
              <EmptyState
                className="mt-6"
                icon={<Users className="h-7 w-7" />}
                title="لم تدعُ أحداً بعد"
                description="شارك رابطك الآن مع أول صديق — ستحصل على 100 نقطة بمجرد إتمامه أول طلب."
                action={
                  <Button className="rounded-full font-bold" onClick={shareLink} disabled={!link}>
                    <Share2 className="ms-1 h-4 w-4" />
                    شارك الآن
                  </Button>
                }
              />
            )}
          </>
        )}

        <div className="mt-8 rounded-3xl border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
          <p className="font-bold text-foreground">كيف تعمل؟</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>شارك رابطك مع أصدقائك وعائلتك.</li>
            <li>عند تسجيل صديقك عبر الرابط، يحصل فوراً على كود خصم 10% لأول طلب.</li>
            <li>
              بعد إتمامه أول طلب مؤكَّد الدفع، تحصل أنت على 100 نقطة تُضاف لحسابك في «مكافآت كيدزي»
              — هذا يمنع إساءة استخدام الإحالات بحسابات وهمية.
            </li>
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  );
}
