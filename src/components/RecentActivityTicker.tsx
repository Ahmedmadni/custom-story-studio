import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Radio } from "lucide-react";

import { getActivityFeed } from "@/features/stats/stats.functions";

/**
 * شريط نشاط حيّ متجدّد (F9) — يعرض آخر الأحداث العامة (طلب سُلّم / ترقية مستوى)
 * كإثبات اجتماعي متحرّك. يتجاهل نفسه إن لم توجد بيانات كافية.
 */
export function RecentActivityTicker() {
  const { data: items } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => getActivityFeed(),
    staleTime: 1000 * 60 * 3,
  });

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!items || items.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(id);
  }, [items]);

  if (!items || items.length === 0) return null;

  const current = items[index % items.length];

  return (
    <div className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold text-primary sm:text-sm">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Radio className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <span key={current.at} className="animate-pop-in truncate">
        {current.text} · منذ {formatDistanceToNow(new Date(current.at), { locale: ar })}
      </span>
    </div>
  );
}
