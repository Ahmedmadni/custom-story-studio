import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBlockProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * رسالة خطأ موحّدة بعنوان عربي + زر إعادة محاولة اختياري.
 */
export function ErrorBlock({
  title = "حدث خطأ غير متوقع",
  message = "تعذّر إكمال العملية، حاول مرة أخرى بعد لحظات",
  onRetry,
  className = "",
}: ErrorBlockProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-3xl border-2 border-destructive/30 bg-destructive/5 px-6 py-10 text-center ${className}`}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-extrabold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-5 rounded-full font-bold"
        >
          <RefreshCw className="ms-2 h-4 w-4" />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
