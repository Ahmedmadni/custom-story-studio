import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export type LegalSection = {
  title: string;
  body: ReactNode;
};

/**
 * تخطيط موحّد للصفحات القانونية (/privacy، /terms، /refund-policy) — عنوان،
 * تاريخ آخر تحديث، وأقسام مرقّمة بنص واضح بدل نص عام (Lorem ipsum).
 */
export function LegalPageLayout({
  title,
  updatedAt,
  intro,
  sections,
}: {
  title: string;
  updatedAt: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-extrabold md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">آخر تحديث: {updatedAt}</p>
        {intro && <p className="mt-5 leading-relaxed text-muted-foreground">{intro}</p>}

        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.title} className="rounded-3xl border-2 border-border bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm text-primary">
                  {i + 1}
                </span>
                {s.title}
              </h2>
              <div className="mt-3 space-y-2 leading-relaxed text-muted-foreground">{s.body}</div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
