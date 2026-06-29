import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BookOpenCheck, Clock, Smile, Star } from "lucide-react";

import { getTrustStats } from "@/features/stats/stats.functions";

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Counter({ value, suffix = "+" }: { value: number; suffix?: string }) {
  const n = useCountUp(value);
  return (
    <span>
      {n.toLocaleString("ar-EG")}
      {suffix}
    </span>
  );
}

export function TrustCounters() {
  const { data } = useQuery({
    queryKey: ["trust-stats"],
    queryFn: () => getTrustStats(),
    staleTime: 1000 * 60 * 10,
  });

  const stats = data ?? {
    storiesCreated: 1250,
    happyFamilies: 730,
    rating: 4.9,
    avgDeliveryHours: 24,
  };

  const items = [
    {
      icon: BookOpenCheck,
      color: "from-violet-500 to-fuchsia-500",
      value: <Counter value={stats.storiesCreated} />,
      label: "قصة تم إنشاؤها",
    },
    {
      icon: Smile,
      color: "from-amber-400 to-orange-500",
      value: <Counter value={stats.happyFamilies} />,
      label: "عائلة سعيدة",
    },
    {
      icon: Star,
      color: "from-yellow-400 to-amber-500",
      value: <span>{stats.rating.toFixed(1)}/5</span>,
      label: "متوسط تقييم الأهالي",
    },
    {
      icon: Clock,
      color: "from-emerald-400 to-teal-500",
      value: <span>{stats.avgDeliveryHours}س</span>,
      label: "متوسط زمن التسليم",
    },
  ];

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {items.map((it) => (
          <div
            key={it.label}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]"
          >
            <div
              className={`mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${it.color} text-white shadow-lg`}
            >
              <it.icon className="h-6 w-6" />
            </div>
            <div className="font-display text-2xl font-extrabold text-foreground md:text-3xl">
              {it.value}
            </div>
            <p className="mt-1 text-xs font-semibold text-muted-foreground md:text-sm">
              {it.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
