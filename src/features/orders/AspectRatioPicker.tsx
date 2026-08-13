import { RectangleHorizontal, RectangleVertical, Square } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/features/ai/storyStyle";

const OPTIONS: {
  value: AspectRatio;
  label: string;
  desc: string;
  icon: typeof Square;
}[] = [
  {
    value: "1:1",
    label: "مربع 1:1",
    desc: "تنسيق مربع كلاسيكي لكتاب القصة",
    icon: Square,
  },
  {
    value: "16:9",
    label: "أفقي 16:9",
    desc: "صفحات عريضة مثل مشاهد أفلام الكرتون — مناسبة للقراءة على الشاشة والطباعة العرضية",
    icon: RectangleHorizontal,
  },
  {
    value: "9:16",
    label: "عمودي 9:16",
    desc: "صفحات طولية مناسبة للموبايل ومشاركة صفحات القصة كستوري",
    icon: RectangleVertical,
  },
];

export function AspectRatioPicker({
  value,
  onChange,
  label = "أبعاد الصور والطباعة",
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
  label?: string;
}) {
  return (
    <div>
      <Label className="font-bold">{label}</Label>
      <p className="mt-1 text-xs text-muted-foreground">
        تُستخدم هذه الأبعاد في توليد صور القصة وفي ملف الـ PDF النهائي معاً
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
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
