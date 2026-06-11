import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Loader2 } from "lucide-react";
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
    meta: [{ title: "تسجيل الدخول — حكايتي" }],
  }),
  component: AuthPage,
});

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
        error.message.includes("Invalid login")
          ? "بيانات الدخول غير صحيحة"
          : error.message,
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 via-background to-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <BookOpen className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold text-primary">
            حكايتي
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            سجل دخولك لتطلب قصة يكون طفلك بطلها
          </p>
        </div>

        <div className="mt-8 rounded-3xl border-2 border-border bg-card p-6 shadow-lg">
          <Tabs defaultValue="login" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 rounded-full">
              <TabsTrigger value="login" className="rounded-full font-bold">
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full font-bold">
                حساب جديد
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email1" className="font-bold">البريد الإلكتروني</Label>
                <Input
                  id="email1"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="pass1" className="font-bold">كلمة المرور</Label>
                <Input
                  id="pass1"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </div>
              <Button
                className="w-full rounded-full font-bold"
                disabled={busy || !email || !password}
                onClick={() => void signIn()}
              >
                {busy && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                دخول
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="name2" className="font-bold">الاسم</Label>
                <Input
                  id="name2"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="email2" className="font-bold">البريد الإلكتروني</Label>
                <Input
                  id="email2"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="pass2" className="font-bold">كلمة المرور</Label>
                <Input
                  id="pass2"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 rounded-xl"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  6 أحرف على الأقل
                </p>
              </div>
              <Button
                className="w-full rounded-full font-bold"
                disabled={busy || !email || password.length < 6}
                onClick={() => void signUp()}
              >
                {busy && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                إنشاء الحساب
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
            className="w-full rounded-full font-bold"
            onClick={() => void googleSignIn()}
          >
            <svg className="ms-2 h-4 w-4" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
}
