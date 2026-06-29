import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function useFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("favorites")
        .select("template_id")
        .eq("user_id", user!.id);
      return new Set((data ?? []).map((r) => r.template_id as string));
    },
  });
}

export function FavoriteButton({
  templateId,
  className,
  size = "md",
}: {
  templateId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: favs } = useFavoriteIds();
  const isFav = favs?.has(templateId) ?? false;

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجّل دخولك لحفظ القصة في المفضلة");
      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("template_id", templateId);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, template_id: templateId });
      if (error) throw error;
      return "added" as const;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["favorites", user?.id] });
      toast.success(res === "added" ? "أُضيفت للمفضلة ❤️" : "أزلتها من المفضلة");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "تعذّر التحديث");
    },
  });

  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  return (
    <button
      type="button"
      aria-label={isFav ? "إزالة من المفضلة" : "أضف للمفضلة"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate();
      }}
      disabled={toggle.isPending}
      className={cn(
        "grid place-items-center rounded-full border border-border/60 bg-card/95 shadow-sm backdrop-blur transition-all hover:scale-110 hover:border-pink-400 disabled:opacity-50",
        dims,
        isFav && "border-pink-400 bg-pink-50 text-pink-500",
        className,
      )}
    >
      <Heart className={cn(iconSize, isFav && "fill-current")} />
    </button>
  );
}
