import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Gift, Sparkles, ShoppingBag, Star, UserPlus, Users } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LEVELS, levelFor, nextLevel, progressToNext } from "@/features/rewards/levels";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({ meta: [{ title: "مكافآت كيدزي" }] }),
  component: RewardsPage,
});

const REWARDS = [
  { points: 100, emoji: "💸", title: "خصم 25 جنيه", desc: "على أي طلب" },
  { points: 200, emoji: "📈", title: "ترقية حجم القصة", desc: "من 10 إلى 16 صفحة مجاناً" },
  { points: 500, emoji: "🎁", title: "قصة مجانية كاملة", desc: "بأفكارك الخاصة" },
];

const EARN_RULES = [
  { icon: UserPlus, points: 50, label: "تسجيل حساب جديد" },
  { icon: ShoppingBag, points: 30, label: "إتمام قصة واستلامها" },
  { icon: Star, points: 30, label: "كتابة تقييم بعد الاستلام" },
  { icon: Users, points: 100, label: "دعوة صديق بعد أول طلب مؤكّد له" },
];

function txTypeLabel(t: string) {
  const map: Record<string, string> = {
    signup: "مكافأة التسجيل",
    purchase: "طلب جديد",
    first_purchase: "أول طلب",
    review: "تقييم قصة",
    review_submitted: "تقييم قصة",
    story_completed: "إتمام قصة",
    referral: "دعوة صديق",
    birthday: "عيد ميلاد",
    redeem: "استبدال",
  };
  return map[t] ?? t;
}

function RewardsPage() {
  const { user } = useAuth();
  const { data: account, isLoading } = useQuery({
    queryKey: ["reward-account", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("reward_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: txs } = useQuery({
    queryKey: ["reward-tx", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("reward_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const balance = account?.balance ?? 0;
  const lifetime = account?.lifetime_points ?? 0;
  const lvl = levelFor(lifetime);
  const next = nextLevel(lifetime);
  const prog = progressToNext(lifetime);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold md:text-4xl">
          <Award className="h-7 w-7 text-amber-500" />
          مكافآت كيدزي
        </h1>
        <p className="mt-2 text-muted-foreground">
          اجمع النقاط مع كل قصة، وافتح مستويات جديدة ومكافآت حصرية.
        </p>

        {/* Balance card */}
        <div
          className={`mt-6 overflow-hidden rounded-3xl bg-gradient-to-br ${lvl.color} p-6 text-white shadow-xl sm:p-8`}
        >
          {isLoading ? (
            <Skeleton className="h-32 bg-white/20" />
          ) : (
            <>
              <Badge className="bg-white/20 text-white">
                {lvl.emoji} {lvl.label}
              </Badge>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-display text-5xl font-extrabold">
                  {balance.toLocaleString("ar-EG")}
                </span>
                <span className="mb-2 text-lg font-bold opacity-90">نقطة</span>
              </div>
              <p className="mt-1 text-sm opacity-90">
                مدى الحياة: {lifetime.toLocaleString("ar-EG")} نقطة
              </p>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span>التقدّم نحو {next ? `${next.emoji} ${next.label}` : "أقصى مستوى 👑"}</span>
                  <span className="font-bold">{prog.pct}%</span>
                </div>
                <Progress value={prog.pct} className="h-3 bg-white/20" />
                {next && (
                  <p className="mt-2 text-xs opacity-90">
                    تبقّى {prog.remaining.toLocaleString("ar-EG")} نقطة
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Levels */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold">المستويات</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((l) => {
              const active = l.key === lvl.key;
              return (
                <div
                  key={l.key}
                  className={`rounded-2xl border-2 p-4 text-center ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <div className="text-4xl">{l.emoji}</div>
                  <div className="mt-1 font-display text-lg font-extrabold">{l.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.min}
                    {l.max === Infinity ? "+" : ` - ${l.max - 1}`} نقطة
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Available rewards */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold">المكافآت المتاحة</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {REWARDS.map((r) => {
              const can = balance >= r.points;
              return (
                <div
                  key={r.title}
                  className={`rounded-3xl border-2 p-5 ${
                    can ? "border-emerald-400 bg-emerald-50" : "border-border bg-card opacity-80"
                  }`}
                >
                  <div className="text-4xl">{r.emoji}</div>
                  <div className="mt-2 font-display text-lg font-extrabold">{r.title}</div>
                  <div className="text-sm text-muted-foreground">{r.desc}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold">{r.points} نقطة</span>
                    <Button size="sm" disabled variant="outline">
                      {can ? "الاستبدال قريباً" : "غير متاح"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            * الاستبدال الإلكتروني لم يُفعّل بعد. الرصيد وسجل النقاط حقيقيان، ولن تُخصم نقاطك قبل إطلاق الاستبدال.
          </p>
        </section>

        {/* Earn rules */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold">كيف تكسب النقاط؟</h2>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {EARN_RULES.map((r) => (
              <div key={r.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <r.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.label}</div>
                  <div className="text-xs font-bold text-primary">+{r.points} نقطة</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button asChild variant="outline" className="rounded-full font-bold">
              <Link to="/referrals">
                <UserPlus className="ms-1 h-4 w-4" />
                ادعُ صديقاً الآن
              </Link>
            </Button>
          </div>
        </section>

        {/* History */}
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-bold">سجل النقاط</h2>
          {!txs || txs.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-7 w-7" />}
              title="لا توجد حركات نقاط بعد"
              description="اطلب قصة أو ادعُ صديقاً لتبدأ في جمع النقاط وفتح المكافآت."
              action={
                <Button asChild className="rounded-full font-bold">
                  <Link to="/stories">تصفّح القصص</Link>
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border bg-card divide-y">
              {txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <div className="text-sm font-semibold">{t.note || txTypeLabel(t.type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("ar-EG")}
                    </div>
                  </div>
                  <div
                    className={`font-display text-lg font-extrabold ${
                      t.points >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {t.points >= 0 ? "+" : ""}
                    {t.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-10 flex justify-center">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/stories">
              <Sparkles className="ms-2 h-5 w-5" />
              اطلب قصة واكسب نقاط
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
