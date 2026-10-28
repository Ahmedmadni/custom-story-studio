import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { REDEMPTION_POINTS } from "./redemption";

export function RewardDiscountPicker({ selected, onChange, disabled = false }: {
  selected: boolean;
  onChange: (selected: boolean) => void;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const account = useQuery({
    queryKey: ["reward-account", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("reward_accounts")
        .select("balance").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const available = (account.data?.balance ?? 0) >= REDEMPTION_POINTS;
  return (
    <div className="space-y-2 py-3">
      <label className="flex items-center gap-3 text-sm font-bold">
        <Checkbox aria-label="استبدال 100 نقطة بخصم 25 جنيه" checked={selected}
          disabled={disabled || account.isLoading || account.isError || !available}
          onCheckedChange={(value) => onChange(value === true)} />
        <Gift className="h-4 w-4 shrink-0 text-primary" />
        <span>استبدال 100 نقطة بخصم 25 جنيه</span>
      </label>
      <p className="text-xs text-muted-foreground" role="status">
        {account.isLoading ? "جارٍ تحميل الرصيد…" : account.isError ? "تعذر تحميل رصيد النقاط" :
          `رصيدك: ${account.data?.balance ?? 0} نقطة`}
      </p>
    </div>
  );
}