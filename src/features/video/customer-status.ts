import type { CustomerVideoStatusKey } from "@/features/video/contracts";

export const CUSTOMER_VIDEO_STATUS_LABELS: Record<CustomerVideoStatusKey, string> = {
  awaiting_payment: "بانتظار مراجعة التحويل",
  payment_issue: "الإيصال يحتاج إعادة رفع",
  in_production: "قيد الإنتاج",
  ready: "جاهز",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export function toCustomerVideoStatus(input: {
  paymentStatus: string;
  orderStatus: string;
  deliveryStatus: string;
  projectStatus: string | null;
}): CustomerVideoStatusKey {
  if (input.orderStatus === "cancelled" || input.projectStatus === "cancelled") return "cancelled";
  if (input.paymentStatus === "failed") return "payment_issue";
  if (input.deliveryStatus === "delivered") return "delivered";
  if (input.projectStatus === "ready") return "ready";
  if (
    input.paymentStatus === "paid" ||
    input.projectStatus === "paid" ||
    input.projectStatus === "approved" ||
    input.projectStatus === "processing"
  ) {
    return "in_production";
  }
  return "awaiting_payment";
}
