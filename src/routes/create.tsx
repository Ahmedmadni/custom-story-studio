import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { generateAiStory } from "@/lib/ai.functions";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "أنشئ قصة بالذكاء الاصطناعي — حكايتي" },
      {
        name: "description",
        content: "أنشئ قصة أطفال جديدة فريدة بالذكاء الاصطناعي حول القيمة التي تريد غرسها في طفلك.",
      },
    ],
  }),
  component: CreateStory,
});

function CreateStory() {
  const { user, loading } = useAuth();
  const generateFn = useServerFn(generateAiStory);
  const [childName, setChildName] = useState("");
  const [theme, setTheme] = useState("");
  const [ageRange, setAgeRange] = useState("4-8");

  const mutation = useMutation({
    mutationFn: () =>
      generateFn({ data: { childName, theme, ageRange } }),
    onError: (e: Error) => toast.error(e.message || "تعذر توليد القصة"),
  });

  const story = mutation.data;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground">
            <Wand2 className="h-4 w-4" />
            مدعوم بالذكاء الاصطناعي
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold">
            أنشئ حكاية جديدة لطفلك
          </h1>
          <p className="mt-3 text-muted-foreground">
            اكتب القيمة أو الفكرة التي تريدها، وسنؤلف قصة فريدة من 6 صفحات
            يكون طفلك بطلها
          </p>
        </div>

        {!loading && !user ? (
          <div className="mt-10 rounded-3xl border-2 border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold">
              سجل الدخول أولاً لإنشاء قصتك الخاصة
            </p>
            <Button asChild className="mt-4 rounded-full px-8 font-bold">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border-2 border-border bg-card p-6 shadow-sm md:p-8">
            <div className="grid gap-5">
              <div>
                <Label htmlFor="childName" className="font-bold">
                  اسم الطفل
                </Label>
                <Input
                  id="childName"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: يوسف"
                  maxLength={40}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="theme" className="font-bold">
                  فكرة القصة أو القيمة المطلوبة
                </Label>
                <Textarea
                  id="theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="مثال: قصة عن الصدق ومساعدة الجيران، تدور أحداثها في حديقة الحي…"
                  maxLength={300}
                  rows={3}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="age" className="font-bold">
                  الفئة العمرية
                </Label>
                <Input
                  id="age"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  placeholder="4-8"
                  maxLength={10}
                  className="mt-2 w-32 rounded-xl"
                />
              </div>
              <Button
                size="lg"
                disabled={mutation.isPending || !childName.trim() || theme.trim().length < 3}
                onClick={() => mutation.mutate()}
                className="rounded-full text-base font-bold shadow-lg"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="ms-2 h-5 w-5 animate-spin" />
                    جارٍ تأليف الحكاية…
                  </>
                ) : (
                  <>
                    <Sparkles className="ms-2 h-5 w-5" />
                    ألّف الحكاية الآن
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {story && (
          <div className="mt-10 rounded-3xl border-2 border-primary/30 bg-card p-6 shadow-lg md:p-8">
            <span className="text-xs font-bold text-accent">قصتك الجديدة ✨</span>
            <h2 className="mt-1 font-display text-3xl font-extrabold">
              {story.title}
            </h2>
            <p className="mt-2 text-muted-foreground">{story.summary}</p>
            {story.moral && (
              <p className="mt-2 text-sm font-semibold text-candy">
                💝 القيمة: {story.moral}
              </p>
            )}
            <div className="mt-6 space-y-3">
              {story.pages.map((p) => (
                <div key={p.n} className="rounded-2xl bg-secondary/50 p-4">
                  <span className="text-xs font-bold text-accent">
                    الصفحة {p.n}
                  </span>
                  <p className="mt-1 leading-relaxed">
                    {p.text.replaceAll("{child}", childName || "بطلنا")}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button
                asChild
                size="lg"
                className="rounded-full px-10 text-base font-bold shadow-lg"
              >
                <Link to="/order/$templateId" params={{ templateId: story.id }}>
                  <Camera className="ms-2 h-5 w-5" />
                  اطلبها الآن بصورة طفلك
                </Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                ستُرسم كل صفحة بأسلوب كرتوني ثلاثي الأبعاد وطفلك هو البطل
              </p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
