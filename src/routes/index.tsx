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

import heroImg from "@/assets/kidzy-hero.png";
import iconAi from "@/assets/icon-ai.png";
import iconBooks from "@/assets/icon-books.png";
import iconGames from "@/assets/icon-games.png";
import iconPuzzles from "@/assets/icon-puzzles.png";
import mascotMonster from "@/assets/mascot-monster.png";
import mascotChick from "@/assets/mascot-chick.png";
import aiLaptop from "@/assets/ai-laptop.png";
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
        .select("id, child_name, status, template:story_templates!orders_template_id_fkey(id, slug, title, cover_url)")
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
                className="h-16 rounded-2xl bg-primary px-10 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-95"
              >
                <Link to="/stories">
                  <PlayCircle className="ms-2 h-6 w-6" />
                  تصفّح القصص
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
            {/* فقاعات مرحة ملوّنة خلف الصورة */}
            <div className="pointer-events-none absolute inset-0 -z-10">
              <span className="absolute right-4 top-6 h-5 w-5 rounded-full bg-pink-400/80 blur-[1px]" />
              <span className="absolute left-8 top-20 h-6 w-6 rounded-full bg-sky-400/80 blur-[1px]" />
              <span className="absolute -left-2 bottom-24 h-4 w-4 rounded-full bg-emerald-400/80 blur-[1px]" />
              <span className="absolute right-10 bottom-10 h-7 w-7 rounded-full bg-amber-300/90 blur-[1px]" />
              <span className="absolute right-1/3 top-2 text-2xl">⭐</span>
              <span className="absolute left-1/4 bottom-2 text-xl">✨</span>
            </div>
            <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-gradient-to-tr from-primary/25 via-candy/15 to-accent/15 blur-3xl" />
            <img
              src={heroImg}
              alt="طفل سعيد يقرأ كتاباً سحرياً مع روبوت كيدزي"
              width={1280}
              height={1024}
              className="relative mx-auto w-full max-w-[640px] drop-shadow-[0_25px_50px_rgba(108,77,255,0.25)]"
            />
            {heroStory && (
              <div className="absolute inset-x-6 -bottom-2 mx-auto max-w-md rounded-2xl border border-white/60 bg-white/90 p-3 shadow-[var(--shadow-card)] backdrop-blur-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-primary">قصة اليوم المميزة</span>
                    <h3 className="truncate font-display text-base font-extrabold text-foreground">
                      {heroStory.title}
                    </h3>
                  </div>
                  <Button asChild size="sm" className="shrink-0 rounded-full bg-primary px-4 font-bold">
                    <Link to="/stories/$slug" params={{ slug: heroStory.slug }}>اقرأ الآن</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ FEATURE ICONS (4 cards) ============ */}
      <section className="container mx-auto -mt-6 px-4">
        <div className="rounded-[2rem] border border-border/60 bg-card/90 p-6 shadow-[var(--shadow-card)] backdrop-blur md:p-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { img: iconAi, to: "/create", title: "قصص بالذكاء الاصطناعي", desc: "قصص مخصّصة لطفلك بتقنية الذكاء الاصطناعي" },
              { img: iconBooks, to: "/books", title: "كتب تعليمية", desc: "كتب تفاعلية ومحتوى تعليمي ممتع ومفيد" },
              { img: iconGames, to: "/games", title: "ألعاب تعليمية", desc: "ألعاب شيّقة تنمّي المهارات وتعزّز التعلم" },
              { img: iconPuzzles, to: "/puzzles", title: "ألغاز وتحديات", desc: "ألغاز متنوّعة لتنمية التفكير والذكاء" },
            ].map((f) => (
              <Link
                key={f.to}
                to={f.to}
                className="group flex flex-col items-center text-center transition-transform hover:-translate-y-1"
              >
                <img
                  src={f.img}
                  alt={f.title}
                  width={512}
                  height={512}
                  loading="lazy"
                  className="h-24 w-24 object-contain drop-shadow-lg transition-transform group-hover:scale-110 md:h-28 md:w-28"
                />
                <h3 className="mt-3 font-display text-base font-extrabold md:text-lg">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground md:text-sm">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS (3 steps + mascots) ============ */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="inline-flex items-center gap-3 font-display text-2xl font-extrabold md:text-3xl">
            <span className="h-px w-10 bg-muted-foreground/40" />
            كيف تعمل المنصة؟
            <span className="h-px w-10 bg-muted-foreground/40" />
          </h2>
        </div>
        <div className="relative grid items-start gap-8 md:grid-cols-[auto_1fr_auto] md:gap-4">
          <img
            src={mascotMonster}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="hidden h-40 w-40 object-contain drop-shadow-xl md:block"
          />
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: 1, color: "from-violet-500 to-violet-700", title: "اختر العمر", desc: "حدّد عمر طفلك للحصول على محتوى مناسب له" },
              { n: 2, color: "from-sky-400 to-sky-600", title: "اختر الاهتمامات", desc: "اختر مجالات اهتمام طفلك لنقدّم له الأفضل" },
              { n: 3, color: "from-emerald-400 to-emerald-600", title: "استمتع بالتعلم", desc: "استمتع بمحتوى تعليمي تفاعلي ممتع وآمن" },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${s.color} font-display text-2xl font-black text-white shadow-lg`}>
                  {s.n}
                </div>
                <h3 className="mt-4 font-display text-lg font-extrabold text-primary">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-[220px] text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <img
            src={mascotChick}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="hidden h-40 w-40 object-contain drop-shadow-xl md:block"
          />
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
              <span className="pointer-events-none absolute right-4 top-2 text-2xl">⭐</span>
              <span className="pointer-events-none absolute left-2 top-10 h-4 w-4 rounded-full bg-pink-400/80" />
              <span className="pointer-events-none absolute right-10 bottom-6 h-5 w-5 rounded-full bg-sky-400/80" />
              <span className="pointer-events-none absolute left-8 bottom-2 h-4 w-4 rounded-full bg-emerald-400/80" />
              <img
                src={aiLaptop}
                alt="إنشاء قصة بالذكاء الاصطناعي على كيدزي"
                width={1024}
                height={768}
                loading="lazy"
                className="relative mx-auto w-full max-w-[520px] drop-shadow-[0_20px_40px_rgba(108,77,255,0.25)]"
              />
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
