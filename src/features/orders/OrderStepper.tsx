import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface OrderStepInput {
  status: string;
  payment_status: string | null;
  created_at?: string | null;
}

const STEPS = [
  { key: "received", label: "استلام الطلب", icon: "📥" },
  { key: "await_payment", label: "انتظار الدفع", icon: "💳" },
  { key: "payment_confirmed", label: "تأكيد الدفع", icon: "✅" },
  { key: "writing", label: "كتابة القصة", icon: "✍️" },
  { key: "designing", label: "تصميم الرسومات", icon: "🎨" },
  { key: "qa", label: "مراجعة الجودة", icon: "🔍" },
  { key: "delivered", label: "تسليم القصة", icon: "🎁" },
] as const;

function activeIndex(o: OrderStepInput): number {
  const pay = o.payment_status ?? "unpaid";
  if (o.status === "sent") return 6;
  if (o.status === "ready") return 5;
  if (o.status === "generating") return 4;
  if (o.status === "approved") return 3;
  if (pay === "verified") return 2;
  if (pay === "receipt_uploaded") return 1;
  return 0;
}

export function OrderStepper({ order }: { order: OrderStepInput }) {
  const idx = activeIndex(order);
  const created = order.created_at ? new Date(order.created_at) : null;
  const eta = created ? new Date(created.getTime() + 48 * 60 * 60 * 1000) : null;

  return (
    <div className="rounded-2xl border-2 border-border bg-card/60 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const current = i === idx;
          return (
            <div key={s.key} className="flex flex-1 min-w-[64px] flex-col items-center text-center">
              <div
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border-2 text-sm font-extrabold transition-all",
                  done && "border-grass bg-grass text-grass-foreground",
                  current && "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--ring)]/30 animate-pulse",
                  !done && !current && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <span>{s.icon}</span>}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] leading-tight font-bold sm:text-xs",
                  current && "text-primary",
                  done && "text-grass",
                  !done && !current && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="hidden" />
              )}
            </div>
          );
        })}
      </div>
      {idx < 6 && eta && (
        <p className="mt-1 text-center text-[11px] text-muted-foreground">
          ⏱️ التسليم المتوقع: {eta.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}
        </p>
      )}
    </div>
  );
}
