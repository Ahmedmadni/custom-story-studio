import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  completeOnboarding,
  getOnboardingStatus,
} from "@/features/onboarding/onboarding.functions";

const STORAGE_KEY = "kidzy_onboarding_done";

type OnboardingStep = {
  emoji: string;
  title: string;
  description: string;
  to?: "/children/create" | "/stories" | "/create";
  cta?: string;
};

const STEPS: OnboardingStep[] = [
  {
    emoji: "👋",
    title: "أهلاً بك في كيدزي!",
    description:
      "منصة القصص المصوّرة التي يكون فيها طفلك هو بطل الحكاية. خطوات قليلة وتبدأ رحلتكما.",
  },
  {
    emoji: "🧒",
    title: "أنشئ ملف طفلك الأول",
    description: "احفظ اسم طفلك وعمره وصورته مرة واحدة — تُستخدم تلقائياً في كل قصة تطلبها لاحقاً.",
    to: "/children/create",
    cta: "أنشئ الملف الآن",
  },
  {
    emoji: "🎨",
    title: "اختر اهتماماته المفضّلة",
    description: "الألوان، الشخصيات المفضّلة، والهوايات — كلها تجعل القصة أقرب لقلب طفلك.",
  },
  {
    emoji: "📚",
    title: "استكشف مكتبة القصص",
    description:
      "عشرات القصص الجاهزة بمختلف التصنيفات والمناسبات — جرّب المعاينة المجانية لأي قصة.",
    to: "/stories",
    cta: "تصفّح القصص",
  },
  {
    emoji: "✨",
    title: "أنشئ أول قصة مخصّصة",
    description: "بأفكارك الخاصة، بالذكاء الاصطناعي — اسم طفلك، عمره، والموضوع الذي يحبه.",
    to: "/create",
    cta: "ابدأ الآن",
  },
];

/**
 * معالج الإعداد الأول (F2) — يظهر مرة واحدة لكل مستخدم جديد. يمكن تخطّيه
 * في أي خطوة. حالة الإكمال محفوظة في profiles.onboarding_completed_at
 * (عبر الخادم) + localStorage كطبقة فورية تمنع الوميض قبل تحميل البيانات.
 */
export function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const statusFn = useServerFn(getOnboardingStatus);
  const completeFn = useServerFn(completeOnboarding);
  const [step, setStep] = useState(0);
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["onboarding-status", user?.id],
    enabled: Boolean(user),
    queryFn: () => statusFn(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY)) setDismissedLocally(true);
  }, []);

  const finish = async () => {
    setDismissedLocally(true);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, "1");
    try {
      await completeFn();
      void qc.invalidateQueries({ queryKey: ["onboarding-status", user?.id] });
    } catch {
      // فشل الحفظ على الخادم لا يجب أن يُعيد إظهار المعالج بإلحاح
    }
  };

  const open = Boolean(user) && status?.completed === false && !dismissedLocally;

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const goNext = async () => {
    if (isLast) {
      await finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const goToLinkedPage = async () => {
    if (!current.to) return;
    await finish();
    void navigate({ to: current.to });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && void finish()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">{current.description}</DialogDescription>

        <div className="flex justify-center gap-1.5 pt-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-3xl">
            {current.emoji}
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {current.description}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          {current.to && (
            <Button className="rounded-full font-bold" onClick={() => void goToLinkedPage()}>
              {current.cta}
            </Button>
          )}
          <Button
            variant={current.to ? "outline" : "default"}
            className="rounded-full font-bold"
            onClick={() => void goNext()}
          >
            {isLast ? "إنهاء" : "التالي"}
          </Button>
          {!isLast && (
            <button
              onClick={() => void finish()}
              className="mt-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
            >
              تخطّي الإعداد
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
