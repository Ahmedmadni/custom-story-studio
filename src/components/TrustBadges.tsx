import { CheckCircle2, Heart, ShieldCheck, Truck, UserCheck } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "دفع آمن" },
  { icon: Heart, label: "محتوى آمن للأطفال" },
  { icon: UserCheck, label: "مراجعة بشرية لكل قصة" },
  { icon: Truck, label: "تسليم سريع" },
  { icon: CheckCircle2, label: "رضا الأهالي" },
] as const;

/**
 * شارات ثقة (F9) — تُستخدم في أكثر من مكان (الرئيسية، الدفع، صفحات القصص)
 * لتعزيز الثقة قبل قرار الشراء.
 */
export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-bold text-muted-foreground sm:text-sm ${className}`}
    >
      {BADGES.map((b) => (
        <span key={b.label} className="inline-flex items-center gap-1.5">
          <b.icon className="h-4 w-4 text-grass" />
          {b.label}
        </span>
      ))}
    </div>
  );
}
