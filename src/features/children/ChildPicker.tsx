import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Sparkles, BookOpen, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ChildAvatar } from "@/features/children/ChildAvatar";
import { childLevelMeta, levelFromXp } from "@/features/rewards/childLevels";

export type ChildPickerProfile = {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  favorite_color: string | null;
  favorite_character: string | null;
  hobbies: string[] | null;
  personality_traits: string[] | null;
  dream_job: string | null;
  super_power: string | null;
  xp: number;
  storyCount: number;
  level: number;
};

export function ChildPicker({
  selectedId,
  onSelect,
  title = "اختر بطل القصة",
  selectedMessage = "✨ سيصبح طفلك بطل هذه القصة",
}: {
  selectedId: string | null;
  onSelect: (child: ChildPickerProfile | null) => void;
  title?: string;
  selectedMessage?: string;
}) {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["checkout-children", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase
        .from("child_profiles")
        .select("*, child_story_universe(experience_points, story_count, level)")
        .order("created_at", { ascending: false });
      return (data ?? []).map((c) => {
        const uRaw = (c as { child_story_universe?: unknown }).child_story_universe;
        const u = Array.isArray(uRaw) ? uRaw[0] : uRaw;
        const xp = (u as { experience_points?: number } | null)?.experience_points ?? 0;
        return {
          id: c.id as string,
          name: c.name as string,
          age: (c.age as number | null) ?? null,
          gender: (c.gender as string | null) ?? null,
          photo_url: (c.photo_url as string | null) ?? null,
          avatar_url: (c.avatar_url as string | null) ?? null,
          favorite_color: (c.favorite_color as string | null) ?? null,
          favorite_character: (c.favorite_character as string | null) ?? null,
          hobbies: (c.hobbies as string[] | null) ?? null,
          personality_traits: (c.personality_traits as string[] | null) ?? null,
          dream_job: (c.dream_job as string | null) ?? null,
          super_power: (c.super_power as string | null) ?? null,
          xp,
          storyCount: (u as { story_count?: number } | null)?.story_count ?? 0,
          level: (u as { level?: number } | null)?.level ?? levelFromXp(xp),
        } satisfies ChildPickerProfile;
      });
    },
  });

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <p className="font-display text-base font-extrabold">{title}</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="rounded-full text-xs">
          <Link to="/children/create">
            <Plus className="ms-1 h-3.5 w-3.5" />
            طفل جديد
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">جارٍ تحميل الأطفال…</div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-xl bg-card p-4 text-center text-sm">
          <p className="text-muted-foreground">لم تُنشئ ملف طفل بعد.</p>
          <Button asChild size="sm" className="mt-2 rounded-full">
            <Link to="/children/create">
              <Plus className="ms-1 h-4 w-4" />
              أضف طفلك الأول
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.map((c) => {
              const isSel = selectedId === c.id;
              const lvl = childLevelMeta(c.level);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(isSel ? null : c)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-start transition-all ${
                    isSel
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <ChildAvatar
                    emoji={c.avatar_url}
                    color={c.favorite_color}
                    photoUrl={c.photo_url}
                    name={c.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-bold">{c.name}</p>
                      {isSel && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p
                      className={`bg-gradient-to-r ${lvl.color} bg-clip-text text-xs font-bold text-transparent`}
                    >
                      {lvl.emoji} مستوى {c.level}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      {c.storyCount} قصة
                      {c.age != null ? ` · ${c.age} سنوات` : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {selectedId && (
            <div className="mt-3 rounded-xl bg-primary/10 p-3 text-center text-sm font-bold text-primary">
              {selectedMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
