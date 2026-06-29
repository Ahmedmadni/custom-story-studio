import { Link } from "@tanstack/react-router";
import { Calendar } from "lucide-react";

import { OCCASIONS } from "@/features/library/occasions";

export function OccasionStrip() {
  return (
    <section className="container mx-auto px-4 py-12">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold md:text-3xl">
            <Calendar className="h-6 w-6 text-primary" />
            قصص لكل مناسبة
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            اختر القصة المثالية لمناسبة طفلك القادمة
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {OCCASIONS.map((o) => (
          <Link
            key={o.key}
            to="/stories"
            search={{ occasion: o.key }}
            className={`group relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br ${o.gradient} p-5 transition-all hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[var(--shadow-card)]`}
          >
            <span className="text-4xl drop-shadow-sm transition-transform group-hover:scale-110">
              {o.emoji}
            </span>
            <h3 className="mt-4 font-display text-base font-extrabold leading-tight">
              {o.label}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
