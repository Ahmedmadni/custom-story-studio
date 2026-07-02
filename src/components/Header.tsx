import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Gift,
  Heart,
  LogOut,
  Menu,
  Shield,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import kidzyLogo from "@/assets/kidzy-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/features/cart/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { levelFor } from "@/features/rewards/levels";

const baseNavLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/stories", label: "القصص" },
  { to: "/books", label: "كتب" },
  { to: "/games", label: "ألعاب" },
  { to: "/puzzles", label: "ألغاز" },
];
const adminOnlyLinks = [{ to: "/create", label: "أنشئ قصة" }];

function LevelBadge() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["reward-account-mini", user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("reward_accounts")
        .select("balance, lifetime_points")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  if (!user) return null;
  const lifetime = data?.lifetime_points ?? 0;
  const balance = data?.balance ?? 0;
  const lvl = levelFor(lifetime);
  return (
    <Link
      to="/rewards"
      className={`hidden items-center gap-1.5 rounded-full bg-gradient-to-r ${lvl.color} px-3 py-1.5 text-xs font-extrabold text-white shadow-sm md:inline-flex`}
      title={`${lvl.label} — ${balance} نقطة`}
    >
      <span>{lvl.emoji}</span>
      <span>{balance.toLocaleString("ar-EG")}</span>
    </Link>
  );
}

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const navLinks = isAdmin ? [...baseNavLinks, ...adminOnlyLinks] : baseNavLinks;

  const userLinks = [
    { to: "/my-children", label: "أطفالي", icon: Users },
    { to: "/my-orders", label: "طلباتي", icon: ShoppingCart },
    { to: "/favorites", label: "المفضلة", icon: Heart },
    { to: "/rewards", label: "مكافآتي", icon: Award },
    { to: "/referrals", label: "ادعُ صديقاً", icon: Gift },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl no-print">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={kidzyLogo.url} alt="Kidzy — كيدزي" className="h-10 w-auto drop-shadow-sm" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              activeProps={{ className: "bg-secondary" }}
            >
              {l.label}
            </Link>
          ))}
          {user &&
            userLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-full px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                activeProps={{ className: "bg-secondary" }}
              >
                {l.label}
              </Link>
            ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-secondary"
            >
              <Shield className="h-4 w-4" />
              لوحة التحكم
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LevelBadge />
          <Link
            to="/cart"
            className="relative inline-flex items-center gap-1 rounded-full bg-secondary px-4 py-2 text-sm font-bold transition-colors hover:bg-secondary/80"
          >
            <ShoppingCart className="h-4 w-4" />
            السلة
            {count > 0 && (
              <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-extrabold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => void signOut()}
            >
              <LogOut className="ms-1 h-4 w-4" />
              خروج
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => void navigate({ to: "/auth" })}
            >
              <Sparkles className="ms-1 h-4 w-4" />
              تسجيل الدخول
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/cart"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <ShoppingCart className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -end-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-extrabold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(!open)}
            aria-label="القائمة"
            className="inline-flex h-9 w-9 items-center justify-center"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-card px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            {user &&
              userLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-4 py-3 font-semibold hover:bg-secondary"
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              ))}
            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-accent hover:bg-secondary"
              >
                لوحة التحكم
              </Link>
            )}
            {user ? (
              <Button
                variant="outline"
                className="mt-2 rounded-full"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                تسجيل الخروج
              </Button>
            ) : (
              <Button
                className="mt-2 rounded-full"
                onClick={() => {
                  setOpen(false);
                  void navigate({ to: "/auth" });
                }}
              >
                تسجيل الدخول
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
