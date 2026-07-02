import { Truck } from "lucide-react";

/**
 * شارة وقت التسليم المقدّر (F8). `hours` اختياري — القيمة الافتراضية 24 ساعة
 * (تُمرَّر من `getTrustStats().avgDeliveryHours` عند توفرها في الصفحة المستدعية).
 */
export function DeliveryTimer({
  hours = 24,
  className = "",
}: {
  hours?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-grass/15 px-3 py-1.5 text-xs font-bold text-grass ${className}`}
    >
      <Truck className="h-3.5 w-3.5" />
      التسليم المتوقع خلال {hours} ساعة
    </span>
  );
}
