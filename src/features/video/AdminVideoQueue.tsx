import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminVideoOrders } from "@/features/video/video-admin.functions";

const labels: Record<string, string> = {
  unpaid: "غير مدفوع",
  pending: "معلق",
  paid: "مدفوع",
  failed: "فشل",
  refunded: "مسترد",
  awaiting_payment: "بانتظار الدفع",
  approved: "معتمد",
  processing: "قيد الإنتاج",
  ready: "جاهز",
  cancelled: "ملغي",
  delivered: "تم التسليم",
  image_generation: "توليد الصورة",
  image_review: "مراجعة الصورة",
  script_generation: "توليد النص",
  script_review: "مراجعة النص",
  video_generation: "توليد المشاهد",
  quality_review: "مراجعة الجودة",
  final_render: "الرندر النهائي",
};
const filters = {
  paymentStatus: ["unpaid", "pending", "paid", "failed", "refunded"],
  projectStatus: [
    "awaiting_payment",
    "paid",
    "approved",
    "processing",
    "ready",
    "failed",
    "cancelled",
  ],
  productionStage: [
    "image_generation",
    "image_review",
    "script_generation",
    "script_review",
    "video_generation",
    "quality_review",
    "final_render",
  ],
  deliveryStatus: ["pending", "delivered"],
} as const;

export function AdminVideoQueue() {
  const list = useServerFn(listAdminVideoOrders);
  const { data, isLoading } = useQuery({ queryKey: ["admin-video-orders"], queryFn: () => list() });
  const [selected, setSelected] = useState<Record<string, string>>({});
  const rows = useMemo(
    () =>
      (data ?? []).filter((row) =>
        Object.entries(selected).every(
          ([key, value]) => !value || String(row[key as keyof typeof row] ?? "") === value,
        ),
      ),
    [data, selected],
  );
  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(filters).map(([key, values]) => (
          <Select
            key={key}
            value={selected[key] || "all"}
            onValueChange={(value) =>
              setSelected((old) => ({ ...old, [key]: value === "all" ? "" : value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={key} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل — {key}</SelectItem>
              {values.map((value) => (
                <SelectItem key={value} value={value}>
                  {labels[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton className="h-12" key={i} />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الطفل</TableHead>
                <TableHead>القالب/القصة</TableHead>
                <TableHead>الإنشاء</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>المشروع</TableHead>
                <TableHead>مرحلة الإنتاج</TableHead>
                <TableHead>التسليم</TableHead>
                <TableHead>موعد التسليم</TableHead>
                <TableHead>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell dir="ltr" className="font-mono text-xs">
                    {row.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>{row.childName}</TableCell>
                  <TableCell>{row.templateTitle}</TableCell>
                  <TableCell>{new Date(row.createdAt).toLocaleDateString("ar-EG")}</TableCell>
                  <TableCell>{labels[row.paymentStatus]}</TableCell>
                  <TableCell>{labels[row.projectStatus]}</TableCell>
                  <TableCell>{row.productionStage ? labels[row.productionStage] : "—"}</TableCell>
                  <TableCell>{labels[row.deliveryStatus]}</TableCell>
                  <TableCell>
                    {row.expectedDeliveryAt
                      ? new Date(row.expectedDeliveryAt).toLocaleDateString("ar-EG")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/videos/$videoOrderId" params={{ videoOrderId: row.id }}>
                        فتح <ExternalLink className="me-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!isLoading && !rows.length && (
          <p className="p-8 text-center text-muted-foreground">لا توجد طلبات مطابقة</p>
        )}
      </div>
    </div>
  );
}
