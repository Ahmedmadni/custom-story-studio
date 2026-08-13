import { RectangleHorizontal, RectangleVertical } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type StoryOrientationValue = "landscape" | "portrait";

const OPTIONS: {
  value: StoryOrientationValue;
  label: string;
  desc: string;
  icon: typeof RectangleHorizontal;
}[] = [
  {
    value: "landscape",
    label: "أفقي (عريض)",
    desc: "صفحات عريضة 16:9 مثل مشاهد أفلام الكرتون — مناسبة للقراءة على الشاشة والطباعة العرضية",
    icon: RectangleHorizontal,
  },
  {
    value: "portrait",
    label: "عمودي (طولي)",
    desc: "صفحات طولية 9:16 مثل كتب الأطفال المطبوعة التقليدية",
    icon: RectangleVertical,
  },
];

export function OrientationPicker({
  value,
  onChange,
  label = "اتجاه صفحات القصة",
}: {
  value: StoryOrientationValue;
  onChange: (v: StoryOrientationValue) => void;
  label?: string;
}) {
  return (
    <div>
      <Label className="font-bold">{label}</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        يحدد شكل الصور وملف الـ PDF النهائي
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-2xl border-2 p-4 text-start transition-colors",
                active
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border hover:border-primary/50",
              )}
            >
              <span className="flex items-center gap-2 font-display text-lg font-bold">
                <Icon className="h-5 w-5 text-primary" />
                {opt.label}
              </span>
              <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
