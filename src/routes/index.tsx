import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  GraduationCap,
  Share2,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "حكايتي — قصص وكتب تعليمية مخصصة لطفلك" },
      {
        name: "description",
        content:
          "منصة متكاملة لإنشاء قصص أطفال وكتب تعليمية مخصصة: اختر من المكتبة أو أنشئ محتوى جديداً بالذكاء الاصطناعي وطفلك هو البطل.",
      },
    ],
  }),
  component: Index,
});

const steps = [
  {
    icon: UserRound,
    title: "١. أدخل بيانات طفلك",
    desc: "الاسم والعمر واللغة، وصورة الطفل اختيارياً ليصبح بطلاً كرتونياً ثلاثي الأبعاد",
    color: "bg-candy text-candy-foreground",
  },
  {
    icon: Wand2,
    title: "٢. اختر وولّد المحتوى",
    desc: "قصة مصورة أو كتاب تعليمي — يؤلفه الذكاء الاصطناعي خلال لحظات",
    color: "bg-primary text-primary-foreground",
  },
  {
    icon: Share2,
    title: "٣. عاين وصدّر وشارك",
    desc: "معاينة تفاعلية للنتيجة، تصدير PDF بضغطة، ومشاركة عبر الواتساب",
    color: "bg-grass text-grass-foreground",
  },
];

function Index() {
  const { data: featuredStories } = useQuery({
    queryKey: ["featured", "story"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "story")
        .limit(4);
      return data ?? [];
    },
  });

  const { data: featuredBooks } = useQuery({
    queryKey: ["featured", "book"],
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, slug, title, summary, category, age_range, cover_url")
        .eq("is_published", true)
        .eq("is_custom", false)
        .eq("content_type", "book")
        .limit(4);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
        <div className="container relative mx-auto grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div className="text-center md:text-start">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground">
              <Sparkles className="h-4 w-4" />
              قصص + كتب تعليمية بأسلوب كرتوني ثلاثي الأبعاد
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
              طفلك هو <span className="text-primary">بطل</span>
              <br />
              الحكاية والتعلم! 📖✨
            </h1>
            <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-muted-foreground md:mx-0">
              قصص نبيلة تزرع القيم، وكتب تعليمية ممتعة تعلّم الحروف والأرقام
              والعلوم — نرسم فيها طفلك بطلاً كرتونياً بملامحه الحقيقية المحسّنة.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Button asChild size="lg" className="rounded-full px-8 text-base font-bold shadow-lg">
                <Link to="/create">
                  <Wand2 className="ms-2 h-5 w-5" />
                  أنشئ الآن خطوة بخطوة
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-2 border-accent px-8 text-base font-bold text-accent hover:bg-accent hover:text-accent-foreground"
              >
                <Link to="/stories">تصفح المكتبة</Link>
              </Button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-primary/30 via-secondary to-accent/30 blur-2xl" />
            <img
              src="/hero.jpg"
              alt="طفل كرتوني ثلاثي الأبعاد يقرأ كتاباً سحرياً"
              className="relative aspect-square w-full rounded-[2.5rem] border-4 border-card object-cover shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            to="/stories"
            className="group flex items-center gap-5 overflow-hidden rounded-3xl border-2 border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
          >
            <img
              src="/covers/treasure-of-honesty.jpg"
              alt="قسم القصص"
              loading="lazy"
              width={768}
              height={1024}
              className="h-32 w-24 shrink-0 rounded-2xl object-cover shadow-md transition-transform group-hover:scale-105"
            />
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-candy/15 px-3 py-1 text-xs font-bold text-candy">
                <BookOpen className="h-3.5 w-3.5" />
                قسم القصص
              </span>
              <h2 className="mt-2 font-display text-2xl font-extrabold">
                قصص مصورة نبيلة
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                أكثر من 20 حكاية تزرع القيم الجميلة وطفلك بطلها
              </p>
            </div>
          </Link>

          <Link
            to="/books"
            className="group flex items-center gap-5 overflow-hidden rounded-3xl border-2 border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary hover:shadow-xl"
          >
            <img
              src="/covers/book-arabic-letters.jpg"
              alt="قسم الكتب التعليمية"
              loading="lazy"
              width={768}
              height={1024}
              className="h-32 w-24 shrink-0 rounded-2xl object-cover shadow-md transition-transform group-hover:scale-105"
            />
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-grass/15 px-3 py-1 text-xs font-bold text-grass">
                <GraduationCap className="h-3.5 w-3.5" />
                قسم الكتب التعليمية
              </span>
              <h2 className="mt-2 font-display text-2xl font-extrabold">
                كتب تعليمية ممتعة
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                الحروف والأرقام والألوان والعلوم بطريقة شيقة ومرحة
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-14">
        <h2 className="text-center font-display text-3xl font-extrabold md:text-4xl">
          ثلاث خطوات بسيطة
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-3xl border-2 border-border bg-card p-7 text-center shadow-sm transition-transform hover:-translate-y-1"
            >
              <span
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ${s.color}`}
              >
                <s.icon className="h-7 w-7" />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured stories */}
      <section className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-extrabold md:text-4xl">
            حكايات مميزة
          </h2>
          <Button asChild variant="ghost" className="rounded-full font-bold text-primary">
            <Link to="/stories">عرض الكل ←</Link>
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {(featuredStories ?? []).map((s) => (
            <StoryCard key={s.id} story={s} />
          ))}
        </div>
      </section>

      {/* Featured books */}
      <section className="container mx-auto px-4 py-10 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-extrabold md:text-4xl">
            كتب تعليمية مميزة
          </h2>
          <Button asChild variant="ghost" className="rounded-full font-bold text-primary">
            <Link to="/books">عرض الكل ←</Link>
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {(featuredBooks ?? []).map((b) => (
            <StoryCard key={b.id} story={b} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
