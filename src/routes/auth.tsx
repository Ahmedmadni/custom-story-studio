import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Cloud, Loader2, Sparkles, Star, Sun, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — حكايتي" },
      {
        name: "description",
        content: "سجّل دخولك إلى حكايتي وحوّل طفلك إلى بطل قصصه وكتبه التعليمية المصوّرة.",
      },
    ],
  }),
  component: AuthPage,
});

/** عناصر طافية لطيفة وخفيفة في الخلفية */
function FloatingDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* هالات لونية دافئة */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sunny/35 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-candy/25 blur-3xl" />
      <div className="absolute top-1/3 -right-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute bottom-1/4 -left-12 h-48 w-48 rounded-full bg-grass/15 blur-3xl" />
      {/* أيقونات طافية بحركة ناعمة */}
      <Sun
        className="animate-float-soft absolute right-[10%] top-[8%] h-10 w-10 text-sunny sm:h-14 sm:w-14"
        style={{ animationDelay: "0s" }}
      />
      <Star
        className="animate-float-soft absolute left-[9%] top-[16%] h-6 w-6 text-accent sm:h-9 sm:w-9"
        style={{ animationDelay: "1.4s" }}
        fill="currentColor"
      />
      <Cloud
        className="animate-float-soft absolute bottom-[12%] left-[14%] h-10 w-10 text-primary/40 sm:h-14 sm:w-14"
        style={{ animationDelay: "2.2s" }}
        fill="currentColor"
      />
      <Sparkles
        className="animate-float-soft absolute bottom-[18%] right-[12%] h-6 w-6 text-candy sm:h-9 sm:w-9"
        style={{ animationDelay: "0.7s" }}
      />
    </div>
  );
}

const FEATURES = [
  { icon: Star, label: "طفلك هو البطل", cls: "bg-sunny/60 text-sunny-foreground" },
  { icon: BookOpen, label: "قصص وكتب تعليمية", cls: "bg-primary/10 text-primary" },
  { icon: Wand2, label: "رسوم كرتونية 3D", cls: "bg-candy/25 text-foreground" },
];

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login") ? "بيانات الدخول غير صحيحة" : error.message,
      );
    } else {
      toast.success("أهلاً بعودتك! 🎉");
      void navigate({ to: "/" });
    }
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { display_name: displayName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("already registered")
          ? "هذا البريد مسجل بالفعل، جرب تسجيل الدخول"
          : error.message,
      );
    } else {
      toast.success("تم إنشاء الحساب! تفقد بريدك لتأكيد التسجيل 📧");
    }
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("تعذر الدخول عبر جوجل");
  };

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/60 via-background to-background px-4 py-10"
    >
      <FloatingDecor />

      <div className="animate-pop-in relative z-10 w-full max-w-md">
        {/* الشعار والتعريف */}
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <BookOpen className="h-8 w-8" />
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold text-primary">حكايتي</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            منصة تحوّل طفلك إلى بطل قصصه وكتبه التعليمية المصوّرة — بأسلوب كرتوني ثلاثي
            الأبعاد، جاهزة للتحميل والمشاركة.
          </p>

          {/* مزايا سريعة */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map((f) => (
              <span
                key={f.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${f.cls}`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* بطاقة الدخول */}
        <div className="mt-6 rounded-3xl border-2 border-border bg-card/95 p-5 shadow-xl shadow-primary/5 backdrop-blur sm:p-7">
          <Tabs defaultValue="login" dir="rtl">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-full bg-muted p-1.5">
              <TabsTrigger
                value="login"
                className="rounded-full text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-full text-sm font-bold data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
              >
                حساب جديد
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email1" className="font-bold">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email1"
                  type="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-12 rounded-2xl text-base"
                />
              </div>
              <div>
                <Label htmlFor="pass1" className="font-bold">
                  كلمة المرور
                </Label>
                <Input
                  id="pass1"
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 rounded-2xl text-base"
                />
              </div>
              <Button
                className="h-12 w-full rounded-full text-base font-bold shadow-md shadow-primary/25"
                disabled={busy || !email || !password}
                onClick={() => void signIn()}
              >
                {busy && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                دخول إلى حكايتي
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="name2" className="font-bold">
                  اسمك
                </Label>
                <Input
                  id="name2"
                  placeholder="مثال: أم يوسف"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 h-12 rounded-2xl text-base"
                />
              </div>
              <div>
                <Label htmlFor="email2" className="font-bold">
                  البريد الإلكتروني
                </Label>
                <Input
                  id="email2"
                  type="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-12 rounded-2xl text-base"
                />
              </div>
              <div>
                <Label htmlFor="pass2" className="font-bold">
                  كلمة المرور
                </Label>
                <Input
                  id="pass2"
                  type="password"
                  dir="ltr"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 rounded-2xl text-base"
                />
                <p className="mt-1 text-xs text-muted-foreground">6 أحرف على الأقل</p>
              </div>
              <Button
                className="h-12 w-full rounded-full bg-accent text-base font-bold text-accent-foreground shadow-md shadow-accent/25 hover:bg-accent/90"
                disabled={busy || !email || password.length < 6}
                onClick={() => void signUp()}
              >
                {busy && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                إنشاء حساب جديد
              </Button>
            </TabsContent>
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">أو</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="h-12 w-full rounded-full text-base font-bold"
            onClick={() => void googleSignIn()}
          >
            <svg className="ms-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            المتابعة عبر جوجل
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          بإنشاء حسابك يمكنك طلب قصص مخصصة بصورة طفلك وتحميلها PDF ومشاركتها عبر واتساب 💛
        </p>
      </div>
    </div>
  );
}
