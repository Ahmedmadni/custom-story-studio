import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Eye, FileDown, Wand2 } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listMyPdfs } from "@/features/pdf/pdf.functions";


export const Route = createFileRoute("/_authenticated/my-orders")({
  head: () => ({
    meta: [{ title: "طلباتي — حكايتي" }],
  }),
  component: MyOrders,
});

function MyOrders() {
  const { user } = useAuth();
  const fetchPdfs = useServerFn(listMyPdfs);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, status, child_name, created_at, story_templates(title, cover_url, slug)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: customStories } = useQuery({
    queryKey: ["my-custom-stories", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("story_templates")
        .select("id, title, summary, created_at")
        .eq("is_custom", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: myPdfs } = useQuery({
    queryKey: ["my-pdfs", user?.id],
    enabled: Boolean(user),
    queryFn: () => fetchPdfs(),
  });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold">طلباتي 📦</h1>

        <div className="mt-8 space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))
          ) : (orders ?? []).length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="لا توجد طلبات بعد"
              description="تصفّح المكتبة واختر القصة التي تحبّها لطفلك."
              action={
                <Button asChild className="rounded-full font-bold">
                  <Link to="/stories">تصفح القصص</Link>
                </Button>
              }
            />

          ) : (
            (orders ?? []).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-5 shadow-sm"
              >
                {o.story_templates?.cover_url ? (
                  <img
                    src={o.story_templates.cover_url}
                    alt=""
                    className="h-20 w-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-16 items-center justify-center rounded-xl bg-secondary">
                    <BookOpen className="h-6 w-6 text-primary/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold">
                    {o.story_templates?.title ?? "قصة"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    البطل: {o.child_name} ·{" "}
                    {new Date(o.created_at).toLocaleDateString("ar-EG")}
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={o.status as string} />
                  </div>
                </div>
                {(o.status === "ready" || o.status === "sent") && (
                  <Button asChild className="rounded-full font-bold">
                    <Link to="/story/$orderId" params={{ orderId: o.id }}>
                      <Eye className="ms-1 h-4 w-4" />
                      شاهد القصة
                    </Link>
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {(customStories ?? []).length > 0 && (
          <div className="mt-12">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <Wand2 className="h-5 w-5 text-accent" />
              قصصي المولدة بالذكاء الاصطناعي
            </h2>
            <div className="mt-4 space-y-3">
              {(customStories ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-5"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-bold">{s.title}</h3>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {s.summary}
                    </p>
                  </div>
                  <Button asChild variant="outline" className="rounded-full font-bold">
                    <Link to="/order/$templateId" params={{ templateId: s.id }}>
                      اطلبها بصورة طفلك
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(myPdfs ?? []).length > 0 && (
          <div className="mt-12">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
              <FileDown className="h-5 w-5 text-grass" />
              ملفاتي PDF المحفوظة 📄
            </h2>
            <div className="mt-4 space-y-3">
              {(myPdfs ?? []).map((f) => (
                <div
                  key={f.name}
                  className="flex flex-wrap items-center gap-4 rounded-3xl border-2 border-border bg-card p-5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-xl">
                    📕
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-lg font-bold">
                      {f.title}
                    </h3>
                    {f.createdAt && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(f.createdAt).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  {f.url && (
                    <Button asChild className="rounded-full font-bold">
                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                        <FileDown className="ms-1 h-4 w-4" />
                        تحميل
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
