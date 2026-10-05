import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_EMOJIS, FAVORITE_COLORS, computeAge } from "@/features/children/avatars";
import { ChildAvatar } from "@/features/children/ChildAvatar";
import { cn } from "@/lib/utils";

export type ChildFormData = {
  id?: string;
  name: string;
  nickname?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  avatar_url?: string | null; // emoji
  favorite_color?: string | null;
  favorite_character?: string | null;
  hobbies?: string[] | null;
  personality_traits?: string[] | null;
  dream_job?: string | null;
  super_power?: string | null;
};

export function ChildForm({ initial }: { initial?: ChildFormData }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<ChildFormData>(
    initial ?? {
      name: "",
      avatar_url: "🦄",
      favorite_color: "#7C3AED",
      hobbies: [],
      personality_traits: [],
    },
  );

  function set<K extends keyof ChildFormData>(k: K, v: ChildFormData[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجّل دخولك أولاً");
      if (!f.name.trim()) throw new Error("اسم الطفل مطلوب");
      const payload = {
        user_id: user.id,
        name: f.name.trim(),
        nickname: f.nickname || null,
        birth_date: f.birth_date || null,
        age: computeAge(f.birth_date),
        gender: f.gender || null,
        avatar_url: f.avatar_url || null,
        favorite_color: f.favorite_color || null,
        favorite_character: f.favorite_character || null,
        hobbies: f.hobbies && f.hobbies.length ? f.hobbies : null,
        personality_traits:
          f.personality_traits && f.personality_traits.length ? f.personality_traits : null,
        dream_job: f.dream_job || null,
        super_power: f.super_power || null,
      };
      if (f.id) {
        const { error } = await supabase.from("child_profiles").update(payload).eq("id", f.id);
        if (error) throw error;
        return f.id;
      }
      const { data, error } = await supabase
        .from("child_profiles")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Keep child creation atomic from the user's perspective. If the
      // companion universe row cannot be created, remove the new profile
      // instead of silently leaving a partially initialized child record.
      const { error: universeError } = await supabase
        .from("child_story_universe")
        .insert({ child_id: data.id });
      if (universeError) {
        const { error: cleanupError } = await supabase
          .from("child_profiles")
          .delete()
          .eq("id", data.id)
          .eq("user_id", user.id);
        if (cleanupError) {
          console.error("failed to compensate partial child profile creation", cleanupError);
        }
        throw new Error("تعذّر تهيئة ملف الطفل بالكامل، حاول مرة أخرى");
      }

      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["children"] });
      toast.success(f.id ? "تم حفظ بيانات الطفل" : "تم إنشاء ملف الطفل ✨");
      navigate({ to: "/children/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-8"
    >
      {/* Identity */}
      <section className="rounded-3xl border bg-card p-6">
        <h2 className="mb-4 font-display text-xl font-bold">الهوية</h2>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <ChildAvatar
            emoji={f.avatar_url}
            color={f.favorite_color}
            name={f.name}
            size="xl"
          />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>الاسم *</Label>
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div>
              <Label>اللقب</Label>
              <Input value={f.nickname ?? ""} onChange={(e) => set("nickname", e.target.value)} />
            </div>
            <div>
              <Label>تاريخ الميلاد</Label>
              <Input
                type="date"
                value={f.birth_date ?? ""}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </div>
            <div>
              <Label>النوع</Label>
              <div className="mt-2 flex gap-2">
                {[
                  { k: "boy", l: "ولد" },
                  { k: "girl", l: "بنت" },
                ].map((o) => (
                  <button
                    type="button"
                    key={o.k}
                    onClick={() => set("gender", o.k)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm",
                      f.gender === o.k && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Avatar */}
      <section className="rounded-3xl border bg-card p-6">
        <h2 className="mb-4 font-display text-xl font-bold">اختر شخصية أفاتار</h2>
        <div className="flex flex-wrap gap-2">
          {AVATAR_EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => set("avatar_url", e)}
              className={cn(
                "grid h-12 w-12 place-items-center rounded-2xl border-2 text-2xl transition",
                f.avatar_url === e
                  ? "border-primary bg-primary/10 scale-110"
                  : "border-border hover:border-primary/50",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <h3 className="mt-6 mb-3 font-display text-base font-bold">اللون المفضّل</h3>
        <div className="flex flex-wrap gap-2">
          {FAVORITE_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => set("favorite_color", c.hex)}
              aria-label={c.label}
              className={cn(
                "h-10 w-10 rounded-full ring-2 ring-offset-2 transition",
                f.favorite_color === c.hex ? "ring-foreground scale-110" : "ring-transparent",
              )}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </section>

      {/* Personality */}
      <section className="rounded-3xl border bg-card p-6">
        <h2 className="mb-4 font-display text-xl font-bold">شخصية البطل</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>شخصيته المفضّلة</Label>
            <Input
              placeholder="سوبرمان، إلسا..."
              value={f.favorite_character ?? ""}
              onChange={(e) => set("favorite_character", e.target.value)}
            />
          </div>
          <div>
            <Label>وظيفة الأحلام</Label>
            <Input
              placeholder="رائد فضاء، طبيب..."
              value={f.dream_job ?? ""}
              onChange={(e) => set("dream_job", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>القوة الخارقة</Label>
            <Input
              placeholder="الطيران، الذكاء، السرعة..."
              value={f.super_power ?? ""}
              onChange={(e) => set("super_power", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>الهوايات (افصل بفاصلة)</Label>
            <Textarea
              rows={2}
              value={(f.hobbies ?? []).join("، ")}
              onChange={(e) =>
                set(
                  "hobbies",
                  e.target.value
                    .split(/[،,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>صفات الشخصية (افصل بفاصلة)</Label>
            <Textarea
              rows={2}
              value={(f.personality_traits ?? []).join("، ")}
              onChange={(e) =>
                set(
                  "personality_traits",
                  e.target.value
                    .split(/[،,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="rounded-full" disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="ms-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ms-2 h-4 w-4" />
          )}
          {f.id ? "حفظ التعديلات" : "إنشاء ملف الطفل"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="rounded-full"
          onClick={() => navigate({ to: "/my-children" })}
        >
          إلغاء
        </Button>
      </div>
    </form>
  );
}
