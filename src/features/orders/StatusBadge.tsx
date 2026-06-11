import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/features/ai/storyTypes";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-primary/15 text-primary",
  generating: "bg-accent/15 text-accent",
  ready: "bg-grass/20 text-grass",
  sent: "bg-grass text-grass-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("rounded-full border-0 font-bold", styles[status])}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const paymentStyles: Record<string, string> = {
  unpaid: "bg-secondary text-secondary-foreground",
  receipt_uploaded: "bg-sunny/30 text-foreground",
  verified: "bg-grass text-grass-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

const paymentLabels: Record<string, string> = {
  unpaid: "لم يُدفع",
  receipt_uploaded: "بانتظار التحقق من الدفع 💰",
  verified: "تم تأكيد الدفع ✅",
  rejected: "الدفع مرفوض ❌",
};

export function PaymentBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("rounded-full border-0 font-bold", paymentStyles[status])}>
      {paymentLabels[status] ?? status}
    </Badge>
  );
}
