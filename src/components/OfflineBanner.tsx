import { WifiOff } from "lucide-react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/** Keeps the connection state visible while cached drawing assets remain usable. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-bold text-destructive-foreground">
      <WifiOff className="h-4 w-4 shrink-0" />
      لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل حتى تعود الشبكة
    </div>
  );
}
