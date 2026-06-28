import { Truck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ComingSoonPrintCard() {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-candy/5 p-5 sm:p-6">
      <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 text-3xl">
          📚
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-extrabold sm:text-xl">
            النسخة المطبوعة قريباً
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            نعمل على إطلاق خدمة طباعة القصص بجودة احترافية مع إمكانية الشحن لجميع المحافظات.
          </p>
          <ul className="mt-3 grid gap-1.5 text-xs font-semibold sm:grid-cols-2">
            <li className="flex items-center gap-2"><span className="text-primary">•</span> غلاف صلب فاخر</li>
            <li className="flex items-center gap-2"><span className="text-primary">•</span> طباعة ملوّنة عالية الجودة</li>
            <li className="flex items-center gap-2"><span className="text-primary">•</span> تغليف هدية أنيق</li>
            <li className="flex items-center gap-2"><span className="text-primary">•</span> أغلفة مخصّصة باسم الطفل</li>
            <li className="flex items-center gap-2"><span className="text-primary">•</span> توصيل لجميع المحافظات</li>
          </ul>
          <Button
            disabled
            className="mt-4 rounded-full bg-primary/80 font-bold opacity-90"
          >
            <Truck className="ms-1.5 h-4 w-4" />
            🚀 قريباً
          </Button>
        </div>
      </div>
    </div>
  );
}
