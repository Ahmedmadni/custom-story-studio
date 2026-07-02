import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, HelpCircle, MessageCircle } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { adminWaLink } from "@/features/orders/whatsapp";
import { SITE_URL } from "@/lib/siteUrl";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا — كيدزي" },
      {
        name: "description",
        content: "تواصل مع فريق كيدزي عبر واتساب لأي استفسار عن الطلبات أو الدفع أو القصص.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-grass/15 text-3xl">
          💬
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold md:text-4xl">تواصل معنا</h1>
        <p className="mt-3 text-muted-foreground">
          فريق كيدزي هنا لمساعدتك — أسرع طريقة للتواصل هي واتساب.
        </p>

        <div className="mt-8 rounded-3xl border-2 border-grass/40 bg-grass/5 p-8">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-grass px-8 font-bold text-grass-foreground hover:bg-grass/90"
          >
            <a
              href={adminWaLink("مرحباً! لدي استفسار عن كيدزي 📖")}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="ms-2 h-5 w-5" />
              راسلنا على واتساب
            </a>
          </Button>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            نرد عادةً خلال ساعات قليلة، طوال أيام الأسبوع
          </p>
        </div>

        <div className="mt-6 rounded-3xl border-2 border-dashed border-border p-6">
          <HelpCircle className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            قبل التواصل، قد تجد إجابتك جاهزة في{" "}
            <Link to="/help" className="font-bold text-primary hover:underline">
              مركز المساعدة
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
