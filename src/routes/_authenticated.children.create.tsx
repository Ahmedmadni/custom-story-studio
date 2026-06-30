import { createFileRoute } from "@tanstack/react-router";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChildForm } from "@/features/children/ChildForm";

export const Route = createFileRoute("/_authenticated/children/create")({
  head: () => ({ meta: [{ title: "إضافة طفل — كيدزي" }] }),
  component: CreateChildPage,
});

function CreateChildPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <h1 className="mb-6 font-display text-3xl font-extrabold">أضف طفلاً جديداً</h1>
        <ChildForm />
      </main>
      <Footer />
    </div>
  );
}
