import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Edit3, Gift, Loader2, Percent, Plus, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  adminAdjustRewardPoints,
  adminListCoupons,
  adminListRewardAccounts,
  adminSaveCoupon,
} from "@/features/admin/commerce.functions";

type CouponRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  category: string | null;
  min_order_egp: number | null;
  max_uses: number | null;
  max_uses_per_user: number;
  used_count: number;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type CouponDraft = {
  id?: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  category: string;
  minOrderEgp: string;
  maxUses: string;
  maxUsesPerUser: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
};

const blankCoupon = (): CouponDraft => ({
  code: "",
  discountType: "percent",
  discountValue: "",
  category: "",
  minOrderEgp: "",
  maxUses: "",
  maxUsesPerUser: "1",
  isActive: true,
  startsAt: "",
  expiresAt: "",
});

function asNullableInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) throw new Error("أدخل رقماً صحيحاً");
  return parsed;
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function couponToDraft(coupon: CouponRow): CouponDraft {
  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type as "percent" | "fixed",
    discountValue: String(coupon.discount_value),
    category: coupon.category ?? "",
    minOrderEgp: coupon.min_order_egp == null ? "" : String(coupon.min_order_egp),
    maxUses: coupon.max_uses == null ? "" : String(coupon.max_uses),
    maxUsesPerUser: String(coupon.max_uses_per_user),
    isActive: coupon.is_active,
    startsAt: toDateInput(coupon.starts_at),
    expiresAt: toDateInput(coupon.expires_at),
  };
}

function couponPayload(draft: CouponDraft) {
  const discountValue = Number(draft.discountValue);
  const maxUsesPerUser = Number(draft.maxUsesPerUser);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new Error("قيمة الخصم غير صحيحة");
  }
  if (!Number.isInteger(maxUsesPerUser) || maxUsesPerUser < 1) {
    throw new Error("حد الاستخدام لكل مستخدم غير صحيح");
  }
  return {
    ...(draft.id ? { id: draft.id } : {}),
    code: draft.code,
    discountType: draft.discountType,
    discountValue,
    category: draft.category.trim() || null,
    minOrderEgp: asNullableInt(draft.minOrderEgp),
    maxUses: asNullableInt(draft.maxUses),
    maxUsesPerUser,
    isActive: draft.isActive,
    startsAt: draft.startsAt || null,
    expiresAt: draft.expiresAt || null,
  };
}

export function CommerceManager() {
  const qc = useQueryClient();
  const listCouponsFn = useServerFn(adminListCoupons);
  const saveCouponFn = useServerFn(adminSaveCoupon);
  const listRewardsFn = useServerFn(adminListRewardAccounts);
  const adjustRewardFn = useServerFn(adminAdjustRewardPoints);

  const couponsQuery = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => listCouponsFn(),
  });
  const rewardsQuery = useQuery({
    queryKey: ["admin-reward-accounts"],
    queryFn: () => listRewardsFn(),
  });

  const [couponDraft, setCouponDraft] = useState<CouponDraft>(blankCoupon);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [rewardSearch, setRewardSearch] = useState("");
  const [rewardTarget, setRewardTarget] = useState<{
    userId: string;
    email: string;
    balance: number;
  } | null>(null);
  const [rewardPoints, setRewardPoints] = useState("");
  const [rewardNote, setRewardNote] = useState("");

  const saveCoupon = useMutation({
    mutationFn: async () => saveCouponFn({ data: couponPayload(couponDraft) }),
    onSuccess: () => {
      toast.success(couponDraft.id ? "تم تحديث كود الخصم" : "تم إنشاء كود الخصم");
      setCouponDraft(blankCoupon());
      setShowCouponForm(false);
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleCoupon = useMutation({
    mutationFn: async (coupon: CouponRow) => {
      const draft = couponToDraft(coupon);
      draft.isActive = !coupon.is_active;
      return saveCouponFn({ data: couponPayload(draft) });
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة الكود");
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjustReward = useMutation({
    mutationFn: async () => {
      if (!rewardTarget) throw new Error("اختر مستخدماً");
      const points = Number(rewardPoints);
      if (!Number.isInteger(points) || points === 0) {
        throw new Error("أدخل عدد نقاط صحيحاً موجباً أو سالباً");
      }
      return adjustRewardFn({
        data: {
          userId: rewardTarget.userId,
          points,
          note: rewardNote,
        },
      });
    },
    onSuccess: () => {
      toast.success("تم تعديل رصيد المكافآت");
      setRewardTarget(null);
      setRewardPoints("");
      setRewardNote("");
      void qc.invalidateQueries({ queryKey: ["admin-reward-accounts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredRewards = useMemo(() => {
    const query = rewardSearch.trim().toLowerCase();
    const rows = rewardsQuery.data ?? [];
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.email.toLowerCase().includes(query) || row.userId.toLowerCase().includes(query),
    );
  }, [rewardSearch, rewardsQuery.data]);

  const coupons = (couponsQuery.data ?? []) as CouponRow[];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Percent className="h-6 w-6 text-primary" />
              أكواد الخصم
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              إنشاء الأكواد وتعديل حدود الاستخدام والتواريخ والتفعيل بدون الرجوع إلى قاعدة البيانات.
            </p>
          </div>
          <Button
            onClick={() => {
              setCouponDraft(blankCoupon());
              setShowCouponForm((value) => !value);
            }}
            className="rounded-full font-bold"
          >
            <Plus className="ms-2 h-4 w-4" />
            كود جديد
          </Button>
        </div>

        {showCouponForm && (
          <div className="rounded-3xl border-2 border-primary/20 bg-card p-4 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-extrabold">
                  {couponDraft.id ? "تعديل كود الخصم" : "إنشاء كود خصم"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  عدد الاستخدامات الحالي لا يمكن تعديله يدوياً.
                </p>
              </div>
              <Badge variant={couponDraft.isActive ? "default" : "secondary"}>
                {couponDraft.isActive ? "مفعّل" : "متوقف"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="الكود">
                <Input
                  value={couponDraft.code}
                  dir="ltr"
                  placeholder="WELCOME20"
                  onChange={(event) =>
                    setCouponDraft((draft) => ({
                      ...draft,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </Field>
              <Field label="نوع الخصم">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={couponDraft.discountType}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({
                      ...draft,
                      discountType: event.target.value as "percent" | "fixed",
                    }))
                  }
                >
                  <option value="percent">نسبة مئوية %</option>
                  <option value="fixed">مبلغ ثابت بالجنيه</option>
                </select>
              </Field>
              <Field label="قيمة الخصم">
                <Input
                  type="number"
                  min="0.01"
                  value={couponDraft.discountValue}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({
                      ...draft,
                      discountValue: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="التصنيف — اختياري">
                <Input
                  value={couponDraft.category}
                  placeholder="مثلاً: مغامرات"
                  onChange={(event) =>
                    setCouponDraft((draft) => ({ ...draft, category: event.target.value }))
                  }
                />
              </Field>
              <Field label="الحد الأدنى للطلب — اختياري">
                <Input
                  type="number"
                  min="0"
                  value={couponDraft.minOrderEgp}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({
                      ...draft,
                      minOrderEgp: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="إجمالي الاستخدامات — فارغ = غير محدود">
                <Input
                  type="number"
                  min="1"
                  value={couponDraft.maxUses}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({ ...draft, maxUses: event.target.value }))
                  }
                />
              </Field>
              <Field label="الحد لكل مستخدم">
                <Input
                  type="number"
                  min="1"
                  value={couponDraft.maxUsesPerUser}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({
                      ...draft,
                      maxUsesPerUser: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="يبدأ في — اختياري">
                <Input
                  type="datetime-local"
                  value={couponDraft.startsAt}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({ ...draft, startsAt: event.target.value }))
                  }
                />
              </Field>
              <Field label="ينتهي في — اختياري">
                <Input
                  type="datetime-local"
                  value={couponDraft.expiresAt}
                  onChange={(event) =>
                    setCouponDraft((draft) => ({ ...draft, expiresAt: event.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={couponDraft.isActive ? "default" : "outline"}
                onClick={() =>
                  setCouponDraft((draft) => ({ ...draft, isActive: !draft.isActive }))
                }
              >
                {couponDraft.isActive ? "الكود مفعّل" : "الكود متوقف"}
              </Button>
              <Button
                disabled={saveCoupon.isPending}
                onClick={() => saveCoupon.mutate()}
                className="font-bold"
              >
                {saveCoupon.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                {couponDraft.id ? "حفظ التعديل" : "إنشاء الكود"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCouponDraft(blankCoupon());
                  setShowCouponForm(false);
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card shadow-sm">
          {couponsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : coupons.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              لا توجد أكواد خصم حتى الآن.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40">
                  <TableHead className="text-start">الكود</TableHead>
                  <TableHead className="text-start">الخصم</TableHead>
                  <TableHead className="text-start">الاستخدام</TableHead>
                  <TableHead className="text-start">الحالة</TableHead>
                  <TableHead className="text-start">الصلاحية</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div>
                        <p className="font-bold" dir="ltr">
                          {coupon.code}
                        </p>
                        {coupon.category && (
                          <p className="text-xs text-muted-foreground">{coupon.category}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {coupon.discount_type === "percent"
                        ? `${coupon.discount_value}%`
                        : `${coupon.discount_value} ج`}
                    </TableCell>
                    <TableCell className="text-sm">
                      {coupon.used_count.toLocaleString("ar-EG")}
                      {" / "}
                      {coupon.max_uses == null
                        ? "∞"
                        : coupon.max_uses.toLocaleString("ar-EG")}
                      <div className="text-xs text-muted-foreground">
                        لكل مستخدم: {coupon.max_uses_per_user}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={coupon.is_active ? "default" : "secondary"}>
                        {coupon.is_active ? "مفعّل" : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {coupon.expires_at
                        ? new Date(coupon.expires_at).toLocaleString("ar-EG")
                        : "بدون انتهاء"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleCoupon.isPending}
                          onClick={() => toggleCoupon.mutate(coupon)}
                        >
                          {coupon.is_active ? "إيقاف" : "تفعيل"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCouponDraft(couponToDraft(coupon));
                            setShowCouponForm(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          <Edit3 className="ms-1 h-3.5 w-3.5" />
                          تعديل
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="space-y-4 border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Gift className="h-6 w-6 text-primary" />
              أرصدة المكافآت
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              عرض الرصيد الحقيقي لكل حساب وإجراء تعديلات إدارية موثقة في سجل النقاط.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pe-9"
              placeholder="ابحث بالإيميل أو المعرّف…"
              value={rewardSearch}
              onChange={(event) => setRewardSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border-2 border-border bg-card shadow-sm">
          {rewardsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-2xl" />
              ))}
            </div>
          ) : filteredRewards.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              لا توجد حسابات مطابقة.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/40">
                  <TableHead className="text-start">المستخدم</TableHead>
                  <TableHead className="text-start">الرصيد</TableHead>
                  <TableHead className="text-start">نقاط مدى الحياة</TableHead>
                  <TableHead className="text-start">آخر تحديث</TableHead>
                  <TableHead className="text-start">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRewards.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <p className="font-bold" dir="ltr">
                        {row.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground" dir="ltr">
                        {row.userId.slice(0, 8)}…
                      </p>
                    </TableCell>
                    <TableCell className="font-display text-lg font-extrabold">
                      {row.balance.toLocaleString("ar-EG")}
                    </TableCell>
                    <TableCell>{row.lifetimePoints.toLocaleString("ar-EG")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.updatedAt).toLocaleString("ar-EG")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRewardTarget({
                            userId: row.userId,
                            email: row.email,
                            balance: row.balance,
                          });
                          setRewardPoints("");
                          setRewardNote("");
                        }}
                      >
                        تعديل الرصيد
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(rewardTarget)}
        onOpenChange={(open) => {
          if (!open && !adjustReward.isPending) setRewardTarget(null);
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>تعديل رصيد المكافآت</DialogTitle>
            <DialogDescription>
              {rewardTarget
                ? `${rewardTarget.email} — الرصيد الحالي ${rewardTarget.balance.toLocaleString("ar-EG")} نقطة`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="النقاط">
              <Input
                type="number"
                min="-10000"
                max="10000"
                placeholder="+50 أو -25"
                value={rewardPoints}
                onChange={(event) => setRewardPoints(event.target.value)}
              />
            </Field>
            <Field label="سبب التعديل">
              <Input
                maxLength={300}
                placeholder="مثلاً: تصحيح رصيد طلب رقم..."
                value={rewardNote}
                onChange={(event) => setRewardNote(event.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              لا يمكن خفض الرصيد تحت الصفر. كل تعديل يُسجل في سجل المكافآت وسجل إجراءات الأدمن.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              disabled={adjustReward.isPending}
              onClick={() => adjustReward.mutate()}
              className="font-bold"
            >
              {adjustReward.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              تأكيد التعديل
            </Button>
            <Button
              variant="outline"
              disabled={adjustReward.isPending}
              onClick={() => setRewardTarget(null)}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-bold">
      <span className="block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
