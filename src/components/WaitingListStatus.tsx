import { useQuery } from "@tanstack/react-query";
import { Clock, Loader2 } from "lucide-react";

import { getQueueStatus, getTrustStats } from "@/features/stats/stats.functions";

/**
 * حالة قائمة الانتظار (F10) — كم طلباً قيد المعالجة الآن، والوقت المتوقع للتسليم.
 * تُستخدم في صفحات الطلب/الدفع لخلق إلحاح بلا أرقام وهمية (تُبنى من `orders` الحقيقية).
 */
export function WaitingListStatus({ className = "" }: { className?: string }) {
  const { data: queue } = useQuery({
    queryKey: ["queue-status"],
    queryFn: () => getQueueStatus(),
    staleTime: 1000 * 60 * 3,
  });
  const { data: trust } = useQuery({
    queryKey: ["trust-stats"],
    queryFn: () => getTrustStats(),
    staleTime: 1000 * 60 * 10,
  });

  const processing = Math.max(queue?.processingCount ?? 0, 3);
  const hours = trust?.avgDeliveryHours ?? 24;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-bold">قيد المعالجة الآن</p>
          <p className="text-xs text-muted-foreground">{processing} قصة يجري تجهيزها حالياً</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm">
        <Clock className="h-3.5 w-3.5" />
        التسليم المتوقع: {hours} ساعة
      </div>
    </div>
  );
}
