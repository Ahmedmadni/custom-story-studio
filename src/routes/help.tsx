import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Gift, HelpCircle, Sparkles, Star, Truck, Users, Wallet } from "lucide-react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { adminWaLink } from "@/features/orders/whatsapp";
import { SITE_URL } from "@/lib/siteUrl";

type HelpSection = {
  key: string;
  title: string;
  icon: typeof HelpCircle;
  items: { q: string; a: string }[];
};

const SECTIONS: HelpSection[] = [
  {
    key: "how-it-works",
    title: "كيف تعمل المنصة",
    icon: Sparkles,
    items: [
      {
        q: "كيف أنشئ قصة لطفلي؟",
        a: "اختر قصة من المكتبة أو اطلب قصة بأفكارك الخاصة، ثم أدخل اسم طفلك وعمره وارفع صورته، وادفع عبر فودافون كاش. نراجع طلبك ونرسل القصة كملف PDF على واتساب.",
      },
      {
        q: "هل يظهر طفلي فعلاً في الرسومات؟",
        a: "نعم — نستخدم الذكاء الاصطناعي لتحويل صورة طفلك الحقيقية إلى شخصية كرتونية ثلاثية الأبعاد تظهر في كل صفحات القصة.",
      },
      {
        q: "هل يمكنني معاينة القصة قبل الشراء؟",
        a: "نعم، كل قصة في المكتبة تعرض الغلاف وأول 3 صفحات مجاناً قبل أن تقرر الطلب.",
      },
    ],
  },
  {
    key: "delivery",
    title: "أوقات التسليم",
    icon: Truck,
    items: [
      {
        q: "كم يستغرق تجهيز القصة؟",
        a: "غالباً بين 24 و48 ساعة من تأكيد الدفع، حسب عدد الطلبات في قائمة الانتظار وقتها. تظهر لك حالة الطلب لحظياً في صفحة «طلباتي».",
      },
      {
        q: "كيف تصلني القصة؟",
        a: "كملف PDF جاهز للطباعة أو القراءة على الجوال، يُرسَل مباشرة على رقم واتساب الذي أدخلته عند الطلب.",
      },
      {
        q: "هل تتوفر نسخة مطبوعة؟",
        a: "النسخة المطبوعة والتوصيل قريباً — يمكنك حالياً طباعة ملف الـPDF بنفسك بجودة عالية.",
      },
    ],
  },
  {
    key: "payments",
    title: "الدفع",
    icon: Wallet,
    items: [
      {
        q: "ما وسائل الدفع المتاحة؟",
        a: "حالياً فودافون كاش فقط، عبر تحويل يدوي إلى رقمنا ثم رفع صورة الإيصال للتأكيد.",
      },
      {
        q: "متى يُخصم المبلغ؟",
        a: "أنت من يقوم بالتحويل ثم رفع الإيصال؛ لا نخصم أي مبلغ تلقائياً ولا نطّلع على بيانات بطاقتك البنكية.",
      },
      {
        q: "هل يمكنني استخدام كوبون خصم؟",
        a: "نعم، أدخل كود الخصم في خطوة الدفع قبل تأكيد الطلب وسيُطبَّق الخصم تلقائياً على الإجمالي.",
      },
    ],
  },
  {
    key: "refunds",
    title: "سياسة الاسترجاع",
    icon: HelpCircle,
    items: [
      {
        q: "هل يمكنني استرجاع المبلغ؟",
        a: "نعم، حسب مرحلة الطلب. راجع تفاصيل كاملة في صفحة سياسة الاسترجاع.",
      },
    ],
  },
  {
    key: "story-creation",
    title: "إنشاء القصص",
    icon: BookOpen,
    items: [
      {
        q: "هل يمكنني تخصيص عدد الصفحات؟",
        a: "نعم، تختار بين 10 أو 16 صفحة عند الطلب، ويختلف السعر حسب العدد ونوع القصة (جاهزة أو بأفكارك الخاصة).",
      },
      {
        q: "هل يمكنني تعديل النص بعد التوليد؟",
        a: "في القصص المخصصة بأفكارك، يمكنك مراجعة النص واعتماده قبل التسليم النهائي.",
      },
    ],
  },
  {
    key: "child-profiles",
    title: "ملفات الأطفال",
    icon: Users,
    items: [
      {
        q: "ما فائدة إنشاء ملف لطفلي؟",
        a: "يحفظ ملف الطفل اسمه وصورته وتفضيلاته، فتملأ بياناته تلقائياً عند كل طلب جديد بدل إعادة إدخالها، ويتتبّع مستواه وإنجازاته عبر قصصه المكتملة.",
      },
    ],
  },
  {
    key: "rewards",
    title: "المكافآت",
    icon: Gift,
    items: [
      {
        q: "كيف أكسب نقاطاً؟",
        a: "تكسب نقاطاً عند التسجيل، وعند كل طلب، وعند كتابة تقييم، وعند دعوة صديق ينضم عبر رابطك.",
      },
      {
        q: "كيف أستبدل نقاطي؟",
        a: "تظهر المكافآت المتاحة في صفحة «مكافآتي» — تواصل معنا عبر واتساب لتطبيق الاستبدال حالياً.",
      },
    ],
  },
];

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "مركز المساعدة — كيدزي" },
      {
        name: "description",
        content:
          "إجابات لأكثر أسئلة أهالي كيدزي شيوعاً: كيف تعمل المنصة، التسليم، الدفع، الاسترجاع، وأكثر.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/help` }],
    scripts: [
      {
        attrs: { type: "application/ld+json" },
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: SECTIONS.flatMap((s) =>
            s.items.map((i) => ({
              "@type": "Question",
              name: i.q,
              acceptedAnswer: { "@type": "Answer", text: i.a },
            })),
          ),
        }),
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-3xl">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold md:text-4xl">مركز المساعدة</h1>
          <p className="mt-2 text-muted-foreground">إجابات سريعة لأكثر أسئلة الأهالي شيوعاً</p>
        </div>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.key}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold">
                <section.icon className="h-5 w-5 text-primary" />
                {section.title}
              </h2>
              <Accordion
                type="single"
                collapsible
                className="rounded-3xl border-2 border-border bg-card px-2"
              >
                {section.items.map((item, i) => (
                  <AccordionItem key={i} value={`${section.key}-${i}`}>
                    <AccordionTrigger className="text-start font-bold">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <Star className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            لم تجد إجابتك؟ راسلنا مباشرة وسنساعدك.
          </p>
          <a
            href={adminWaLink("مرحباً! لدي سؤال عن كيدزي 🙋")}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-grass px-5 py-2.5 text-sm font-bold text-grass-foreground shadow-md transition-transform hover:scale-105"
          >
            تواصل عبر واتساب
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            أو راجع{" "}
            <Link to="/refund-policy" className="font-bold text-primary hover:underline">
              سياسة الاسترجاع
            </Link>{" "}
            و{" "}
            <Link to="/privacy" className="font-bold text-primary hover:underline">
              سياسة الخصوصية
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
