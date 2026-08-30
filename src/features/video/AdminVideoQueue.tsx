import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Film } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listAdminVideoOrders } from "@/features/video/video-admin.functions";
import type { AdminVideoQueueFilters } from "@/features/video/contracts";

const labels: Record<string, string> = {
  unpaid: "غير مدفوع",
  pending: "معلق",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refunded: "مسترد",
  awaiting_payment: "بانتظار الدفع",
  approved: "معتمد",
  processing: "قيد الإنتاج",
  ready: "جاهز",
  cancelled: "ملغي",
  image_generation: "تجهيز الصورة",
  image_review: "مراجعة الصورة",
  script_generation: "تجهيز النص",
  script_review: "مراجعة النص",
  video_generation: "إنتاج المشاهد",
  quality_review: "مراجعة الجودة",
  final_render: "الإخراج النهائي",
  delivered: "تم التسليم",
};

function Filter({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value?: string;
  values: string[];
  onChange: (value?: string) => void;
}) {
  return (
    <Select
      value={value ?? "all"}
      onValueChange={(next) => onChange(next === "all" ? undefined : next)}
    >
      <SelectTrigger className="w-full md:w-48">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: الكل</SelectItem>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {labels[item] ?? item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminVideoQueue() {
  const [filters, setFilters] = useState<AdminVideoQueueFilters>({});
  const listFn = useServerFn(listAdminVideoOrders);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-video-orders", filters],
    queryFn: () => listFn({ data: filters }),
  });
  const set = (key: keyof AdminVideoQueueFilters, value?: string) =>
    setFilters((current) => ({ ...current, [key]: value }) as AdminVideoQueueFilters);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Filter
          label="الدفع"
          value={filters.paymentStatus}
          values={["unpaid", "pending", "paid", "failed", "refunded"]}
          onChange={(v) => set("paymentStatus", v)}
        />
        <Filter
          label="حالة المشروع"
          value={filters.projectStatus}
          values={[
            "awaiting_payment",
            "paid",
            "approved",
            "processing",
            "ready",
            "failed",
            "cancelled",
          ]}
          onChange={(v) => set("projectStatus", v)}
        />
        <Filter
          label="مرحلة الإنتاج"
          value={filters.productionStage}
          values={[
            "image_generation",
            "image_review",
            "script_generation",
            "script_review",
            "video_generation",
            "quality_review",
            "final_render",
          ]}
          onChange={(v) => set("productionStage", v)}
        />
        <Filter
          label="التسليم"
          value={filters.deliveryStatus}
          values={["pending", "delivered"]}
          onChange={(v) => set("deliveryStatus", v)}
        />
      </div>
      {error && (
        <p className="rounded-xl bg-destructive/10 p-4 text-destructive">
          تعذر تحميل طابور الفيديو.
        </p>
      )}
      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
      ) : !data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Film className="h-10 w-10 text-muted-foreground" />
            <p className="font-bold">لا توجد طلبات تطابق المرشحات.</p>
          </CardContent>
        </Card>
      ) : (
        data.map((item) => (
          <Card key={item.orderId}>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
              <div>
                <h2 className="font-display text-lg font-extrabold">{item.templateTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.childName} · {item.customerName}
                </p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{item.orderId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{labels[item.paymentStatus] ?? item.paymentStatus}</Badge>
                <Badge>{labels[item.projectStatus] ?? item.projectStatus}</Badge>
                {item.productionStage && (
                  <Badge variant="secondary">{labels[item.productionStage]}</Badge>
                )}
                <Badge variant="outline">
                  {labels[item.deliveryStatus] ?? item.deliveryStatus}
                </Badge>
                <span className="w-full text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString("ar-EG")}
                  {item.expectedDeliveryAt
                    ? ` · متوقع ${new Date(item.expectedDeliveryAt).toLocaleDateString("ar-EG")}`
                    : ""}
                </span>
              </div>
              <Button asChild>
                <Link to="/admin/videos/$videoOrderId" params={{ videoOrderId: item.orderId }}>
                  فتح مساحة الإنتاج <ExternalLink className="ms-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
