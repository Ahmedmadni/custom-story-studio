import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Clock,
  Crown,
  Flame,
  Heart,
  PlayCircle,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";

import heroAsset from "@/assets/kidzy-hero.jpg.asset.json";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { coverUrlOrDefault } from "@/lib/defaultCover";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "كيدزي — عالم القصص المصوّرة الذكية للأطفال" },
      {
        name: "description",
        content:
          "منصة كيدزي للقصص التفاعلية المصوّرة: اكتشف آلاف القصص المصمّمة للأطفال، أو أنشئ قصة مخصّصة لطفلك بالذكاء الاصطناعي خلال ثوانٍ.",
      },
      { property: "og:title", content: "كيدزي — عالم القصص المصوّرة الذكية" },
      {
        property: "og:description",
        content: "اكتشف آلاف القصص التفاعلية أو أنشئ قصة لطفلك بالذكاء الاصطناعي.",
      },
    ],
  }),
  component: Index,
});

const categories = [
  { label: "قصص المغامرات", icon: "🗺️", from: "from-violet-500/15", to: "to-fuchsia-500/15" },
  { label: "قصص الحيوانات", icon: "🦊", from: "from-amber-400/20", to: "to-orange-400/15" },
  { label: "قصص تعليمية", icon: "🎓", from: "from-sky-400/20", to: "to-blue-500/15" },
  { label: "قصص قبل النوم", icon: "🌙", from: "from-indigo-500/15", to: "to-purple-400/15" },
  { label: "قصص الخيال", icon: "🦄", from: "from-pink-400/20", to: "to-rose-400/15" },
  { label: "قصص القيم والأخلاق", icon: "💛", from: "from-emerald-400/20", to: "to-teal-400/15" },
];

const plans = [
  {
    name: "مجاني",
    price: "0",
    tag: "ابدأ مجاناً",
    perks: ["قراءة قصص مختارة", "تجربة محدودة لإنشاء القصص", "الوصول من أي جهاز"],
    cta: "ابدأ الآن",
    highlight: false,
  },
  {
    name: "Premium",
    price: "99",
    tag: "الأكثر شعبية",
    perks: [
      "قصص مصوّرة غير محدودة",
      "محتوى حصري بريميوم",
      "إنشاء قصص بالذكاء الاصطناعي",
      "تنزيل كملفات PDF",
    ],
    cta: "اشترك Premium",
    highlight: true,
  },
  {
    name: "Family",
    price: "159",
    tag: "للعائلة",
    perks: ["كل مزايا Premium", "حتى 4 ملفات أطفال", "تقارير قراءة شهرية", "أولوية الدعم"],
    cta: "خطة العائلة",
    highlight: false,
  },
];

const testimonials = [
  {
    name: "نورا — أم لطفلين",
    text: "ابني صار يطلب قصة كيدزي كل ليلة قبل النوم! الرسومات خرافية والقيم رائعة.",
    avatar: "👩🏻",
  },
  {
    name: "أحمد — أب",
    text: "أنشأت قصة باسم بنتي خلال دقيقة وكانت سعادتها لا توصف. تجربة استثنائية!",
    avatar: "👨🏽",
  },
  {
    name: "سارة — معلّمة",
    text: "أستخدم قصص كيدزي في الفصل، الأطفال يندمجون والقصص ثرية وذكية.",
    avatar: "👩🏼‍🏫",
  },
];

function Index() {
  const { user } = useAuth();

  const { data: featured } = useQuery({
    queryKey: ["home", "featured-stories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: trending } = useQuery({
    queryKey: ["home", "trending-stories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .order("created_at", { ascending: true })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: continueReading } = useQuery({
    queryKey: ["home", "continue-reading", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, child_name, status, template:story_templates(id, slug, title, cover_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const heroStory = featured?.[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="absolute -top-32 -end-32 -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-40 -start-40 -z-10 h-96 w-96 rounded-full bg-candy/15 blur-3xl" />

        <div className="container mx-auto grid items-center gap-10 px-4 pt-10 pb-16 md:grid-cols-2 md:gap-16 md:pt-16 md:pb-24">
          <div className="text-center md:text-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-bold text-primary">
              <Sparkles className="h-4 w-4" />
              منصة Kidzy للقصص المصوّرة الذكية
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.15] tracking-tight text-foreground md:text-6xl">
              عالم من القصص
              <br />
              <span className="bg-gradient-to-l from-primary to-candy bg-clip-text text-transparent">
                المصوّرة الذكية
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground md:mx-0">
              اكتشف آلاف القصص التفاعلية المصمّمة للأطفال — أو أنشئ قصة فريدة
              بطلها طفلك خلال ثوانٍ بقوة الذكاء الاصطناعي.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-2xl bg-primary px-8 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-95"
              >
                <Link to="/stories">
                  <PlayCircle className="ms-2 h-5 w-5" />
                  ابدأ القراءة
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-2xl border-2 border-border bg-card px-8 text-base font-bold hover:border-primary hover:text-primary"
              >
                <Link to="/create">
                  <Wand2 className="ms-2 h-5 w-5" />
                  أنشئ قصة لطفلك
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground md:justify-start">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-sm">👧</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-candy/15 text-sm">🧒</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-accent/30 text-sm">👦</span>
                </div>
                <span className="font-semibold">+5,000 طفل سعيد</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
                <span className="ms-1 font-semibold">4.9 تقييم</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-tr from-primary/30 via-candy/20 to-accent/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-card shadow-[var(--shadow-card)]">
              <img
                src={heroAsset.url}
                alt="أطفال يقرأون قصة سحرية في عالم Kidzy"
                width={1536}
                height={1024}
                className="aspect-[4/3] w-full object-cover"
              />
              {heroStory && (
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/40 bg-white/85 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-primary">قصة اليوم المميزة</span>
                      <h3 className="font-display text-lg font-extrabold leading-snug text-foreground">
                        {heroStory.title}
                      </h3>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className="rounded-full bg-primary px-4 font-bold"
                    >
                      <Link to="/stories/$slug" params={{ slug: heroStory.slug }}>
                        اقرأ الآن
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      <section className="container mx-auto px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-extrabold md:text-3xl">
              تصفّح حسب التصنيف
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              اعثر على القصة المناسبة لاهتمامات طفلك
            </p>
          </div>
        </div>
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <Link
              key={c.label}
              to="/stories"
              className={`group relative flex min-w-[180px] flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br ${c.from} ${c.to} p-5 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-soft)] md:min-w-[210px]`}
            >
              <span className="text-4xl drop-shadow-sm">{c.icon}</span>
              <div>
                <h3 className="font-display text-base font-extrabold leading-tight">
                  {c.label}
                </h3>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  استكشف <ChevronLeft className="h-3 w-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ FEATURED CAROUSEL ============ */}
      <section className="container mx-auto px-4 py-10">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold md:text-3xl">
              <Sparkles className="h-6 w-6 text-primary" />
              قصص مميّزة
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              أفضل ما اخترناه لك هذا الأسبوع
            </p>
          </div>
          <Link
            to="/stories"
            className="hidden text-sm font-bold text-primary hover:underline md:inline"
          >
            عرض الكل ←
          </Link>
        </div>
        <div className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(featured ?? []).map((s, idx) => (
            <Link
              key={s.id}
              to="/stories/$slug"
              params={{ slug: s.slug }}
              className="group relative w-[230px] shrink-0 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-1.5 hover:shadow-[var(--shadow-card)] md:w-[260px]"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                <img
                  src={coverUrlOrDefault(s.cover_url)}
                  alt={s.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
                {idx < 3 && (
                  <Badge className="absolute start-3 top-3 gap-1 rounded-full border-0 bg-accent text-accent-foreground shadow">
                    <Crown className="h-3 w-3" />
                    Premium
                  </Badge>
                )}
                <div className="absolute inset-x-3 bottom-3 text-white">
                  <h3 className="font-display text-lg font-extrabold leading-tight drop-shadow">
                    {s.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-xs font-semibold opacity-90">
                    {s.age_range && <span>👶 {s.age_range}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 5 دقائق
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ============ CONTINUE READING ============ */}
      {user && continueReading && continueReading.length > 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-extrabold md:text-3xl">
                تابع القراءة
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                قصص بدأتها مؤخراً
              </p>
            </div>
            <Link to="/my-orders" className="text-sm font-bold text-primary hover:underline">
              كل طلباتي ←
            </Link>
          </div>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {continueReading.map((o) => {
              const tpl = o.template as { slug?: string; title?: string; cover_url?: string | null } | null;
              if (!tpl?.slug) return null;
              return (
                <Link
                  key={o.id}
                  to="/story/$orderId"
                  params={{ orderId: o.id }}
                  className="group flex w-[280px] shrink-0 items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
                >
                  <img
                    src={coverUrlOrDefault(tpl.cover_url ?? null)}
                    alt={tpl.title}
                    loading="lazy"
                    className="h-20 w-16 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-primary">{o.child_name ?? "طفلك"}</p>
                    <h3 className="line-clamp-2 font-display font-extrabold leading-snug">
                      {tpl.title}
                    </h3>
                  </div>
                  <PlayCircle className="h-6 w-6 shrink-0 text-primary opacity-60 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ============ AI STORY CREATOR ============ */}
      <section className="container mx-auto px-4 py-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-candy/10 p-8 shadow-[var(--shadow-card)] md:p-12">
          <div className="absolute -end-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 -start-10 h-72 w-72 rounded-full bg-candy/20 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1.5 text-sm font-extrabold text-primary">
                <Wand2 className="h-4 w-4" />
                مُنشئ القصص بالذكاء الاصطناعي
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight md:text-5xl">
                أنشئ قصة فريدة
                <br />
                <span className="text-primary">باسم طفلك</span> خلال ثوانٍ
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                أدخل اسم طفلك، عمره، والموضوع الذي يحبه — وستحصل على قصة مصوّرة
                كاملة مع رسوم سينمائية ودرس قيمي مميّز.
              </p>
              <ul className="mt-6 grid gap-3 text-sm font-semibold">
                {["اختر الاسم والعمر", "اختر الموضوع والدرس الأخلاقي", "اختر طول القصة", "احصل عليها فوراً"].map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className="mt-7 h-14 rounded-2xl bg-primary px-8 text-base font-extrabold shadow-[var(--shadow-soft)]"
              >
                <Link to="/create">
                  <Sparkles className="ms-2 h-5 w-5" />
                  ابدأ إنشاء قصتك المخصّصة
                </Link>
              </Button>
            </div>
            <div className="relative">
              <div className="grid gap-3">
                {[
                  { label: "اسم الطفل", value: "ليان", icon: "👧" },
                  { label: "العمر", value: "5 سنوات", icon: "🎂" },
                  { label: "الموضوع", value: "مغامرة فضائية", icon: "🚀" },
                  { label: "الدرس", value: "الشجاعة وحب الاكتشاف", icon: "💫" },
                ].map((f, i) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur"
                    style={{ animation: `pop-in 0.5s ${i * 0.1}s both` }}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-xl">
                      {f.icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-muted-foreground">{f.label}</p>
                      <p className="font-display text-lg font-extrabold">{f.value}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl bg-gradient-to-l from-primary to-candy p-4 text-center font-extrabold text-white shadow-[var(--shadow-soft)]">
                  ✨ قصة ليان جاهزة في 12 ثانية!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TRENDING ============ */}
      {trending && trending.length > 0 && (
        <section className="container mx-auto px-4 py-10">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold md:text-3xl">
                <Flame className="h-6 w-6 text-candy" />
                الأكثر رواجاً
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ما يقرأه الأطفال الآن
              </p>
            </div>
            <Link to="/stories" className="text-sm font-bold text-primary hover:underline">
              عرض الكل ←
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {trending.map((s) => (
              <Link
                key={s.id}
                to="/stories/$slug"
                params={{ slug: s.slug }}
                className="group overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={coverUrlOrDefault(s.cover_url)}
                    alt={s.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 font-display text-sm font-extrabold leading-snug">
                    {s.title}
                  </h3>
                  {s.age_range && (
                    <p className="mt-1 text-xs text-muted-foreground">👶 {s.age_range}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ============ SUBSCRIPTION ============ */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-extrabold text-primary">
            <Crown className="h-4 w-4" />
            خطط الاشتراك
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold md:text-5xl">
            اختر الخطّة المناسبة لعائلتك
          </h2>
          <p className="mt-3 text-muted-foreground">
            ألغِ في أي وقت — بدون التزامات
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl border-2 p-8 transition-all hover:-translate-y-1 ${
                p.highlight
                  ? "border-primary bg-gradient-to-b from-primary/10 to-card shadow-[var(--shadow-card)]"
                  : "border-border bg-card shadow-sm"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-extrabold text-primary-foreground shadow">
                  {p.tag}
                </span>
              )}
              <h3 className="font-display text-2xl font-extrabold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold text-primary">
                  {p.price}
                </span>
                <span className="text-sm text-muted-foreground">ج.م / شهرياً</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="font-semibold text-foreground">{perk}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`mt-8 h-12 w-full rounded-2xl font-extrabold ${
                  p.highlight
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <Link to="/stories">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold md:text-4xl">
            ماذا يقول الآباء عن Kidzy؟
          </h2>
          <p className="mt-3 text-muted-foreground">
            آلاف العائلات يثقون بنا لإسعاد أطفالهم
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center gap-1 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent" />
                ))}
              </div>
              <p className="mt-3 leading-relaxed text-foreground">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-xl">
                  {t.avatar}
                </span>
                <span className="font-bold">{t.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ SECONDARY (books/games/puzzles) ============ */}
      <section className="container mx-auto px-4 pb-16">
        <h3 className="mb-6 text-center font-display text-xl font-bold text-muted-foreground">
          استكشف المزيد
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { to: "/books", icon: BookOpen, label: "كتب تعليمية", desc: "حروف وأرقام وعلوم" },
            { to: "/games", icon: Heart, label: "ألعاب تعليمية", desc: "ألعاب تنمّي المهارات" },
            { to: "/puzzles", icon: Sparkles, label: "ألغاز وتحديات", desc: "تنمية التفكير والذكاء" },
          ].map((i) => (
            <Link
              key={i.to}
              to={i.to}
              className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-soft)]"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <i.icon className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="font-display font-extrabold">{i.label}</p>
                <p className="text-xs text-muted-foreground">{i.desc}</p>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
