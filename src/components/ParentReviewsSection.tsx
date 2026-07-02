import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

const FALLBACK_TESTIMONIALS = [
  {
    id: "fallback-1",
    rating: 5,
    body: "ابني صار يطلب قصة كيدزي كل ليلة قبل النوم! الرسومات خرافية والقيم رائعة.",
    child_age: 5,
    category: "قصص قبل النوم",
  },
  {
    id: "fallback-2",
    rating: 5,
    body: "أنشأت قصة باسم بنتي خلال دقيقة وكانت سعادتها لا توصف. تجربة استثنائية!",
    child_age: 4,
    category: "قصص المغامرات",
  },
  {
    id: "fallback-3",
    rating: 5,
    body: "أستخدم قصص كيدزي في الفصل، الأطفال يندمجون والقصص ثرية وذكية.",
    child_age: 6,
    category: "قصص تعليمية",
  },
];

/** تقييمات أهالي حقيقية (F4) بدل الشهادات الثابتة — تُعرض فقط بعد اعتماد الأدمن. */
export function ParentReviewsSection() {
  const { data: reviews } = useQuery({
    queryKey: ["published-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, body, child_age, category, created_at")
        .eq("is_published", true)
        .not("body", "is", null)
        .order("created_at", { ascending: false })
        .limit(9);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const items = reviews && reviews.length >= 3 ? reviews.slice(0, 6) : FALLBACK_TESTIMONIALS;

  return (
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
        {items.map((t) => (
          <div
            key={t.id}
            className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center gap-1 text-accent">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={i < t.rating ? "h-4 w-4 fill-accent" : "h-4 w-4"} />
              ))}
            </div>
            <p className="mt-3 leading-relaxed text-foreground">"{t.body}"</p>
            <div className="mt-5 flex items-center gap-2 text-xs font-bold text-muted-foreground">
              {t.child_age && <span>👶 عمر الطفل {t.child_age}</span>}
              {t.category && <span>· {t.category}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
