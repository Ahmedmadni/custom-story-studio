import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpen, ShoppingBag, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import {
  nextPackageTier,
  packageTierFor,
  STARTING_PRICE_EGP,
  useCart,
} from "@/features/cart/CartContext";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [{ title: "سلة المشتريات — كيدزي" }],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, remove, count } = useCart();
  const currentTier = packageTierFor(count);
  const upcoming = nextPackageTier(count);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="flex items-center gap-3 font-display text-3xl font-extrabold">
          <ShoppingBag className="h-7 w-7 text-primary" />
          سلة المشتريات
        </h1>
        <p className="mt-2 text-muted-foreground">
          السعر يبدأ من {STARTING_PRICE_EGP} جنيه لكل قصة — تختار عدد الصفحات وخيار الطباعة في
          الخطوة التالية
        </p>

        {count === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<BookOpen className="h-7 w-7" />}
            title="سلتك فارغة"
            description="تصفّح المكتبة واختر القصص أو الكتب التي تريد إهداءها لطفلك."
            action={
              <Button asChild className="rounded-full font-bold">
                <Link to="/stories">تصفح القصص</Link>
              </Button>
            }
          />
        ) : (
          <>
            {(currentTier.discountPct > 0 || upcoming) && (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-sm font-bold text-primary">
                {currentTier.discountPct > 0 && (
                  <p>
                    🎁 باقة {currentTier.label} مُفعّلة — خصم {currentTier.discountPct}% على كل
                    القصص
                  </p>
                )}
                {upcoming && (
                  <p className={currentTier.discountPct > 0 ? "mt-1 opacity-80" : ""}>
                    أضف {upcoming.minItems - count} قصص أخرى ووفّر {upcoming.discountPct}% (باقة{" "}
                    {upcoming.label})
                  </p>
                )}
              </div>
            )}
            <div className="mt-8 space-y-3">
              {items.map((it) => (
                <div
                  key={it.templateId}
                  className="flex items-center gap-4 rounded-3xl border-2 border-border bg-card p-4 shadow-sm"
                >
                  {it.coverUrl ? (
                    <img
                      src={it.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-20 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-secondary">
                      <BookOpen className="h-6 w-6 text-primary/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-bold">{it.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {it.contentType === "book" ? "كتاب تعليمي" : "قصة"}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-display text-sm font-extrabold text-primary">
                      من {STARTING_PRICE_EGP} ج
                    </p>
                    <button
                      onClick={() => remove(it.templateId)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-destructive hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      إزالة
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border-2 border-primary/30 bg-primary/5 p-6">
              <div className="flex items-center justify-between text-lg">
                <span className="font-bold">عدد العناصر</span>
                <span className="font-extrabold">{count}</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                📄 تُسلَّم كل قصة كملف PDF عبر واتساب. يمكنك في الخطوة التالية اختيار طباعة نسخة
                ورقية وتوصيلها لعنوانك.
              </p>

              <Button
                asChild
                size="lg"
                className="mt-6 w-full rounded-full text-base font-bold shadow-lg"
              >
                <Link to="/checkout">إتمام الطلب والدفع ←</Link>
              </Button>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
