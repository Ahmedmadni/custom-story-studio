import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, Menu, Shield, ShoppingCart, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/features/cart/CartContext";

const navLinks = [
  { to: "/", label: "الرئيسية" },
  { to: "/stories", label: "القصص" },
  { to: "/books", label: "الكتب التعليمية" },
  { to: "/games", label: "ألعاب وتعليم" },
  { to: "/puzzles", label: "الألغاز" },
];

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-4 border-secondary bg-card/95 backdrop-blur no-print">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <BookOpen className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl font-bold text-primary">
            حكايتي
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              activeProps={{ className: "bg-secondary" }}
            >
              {l.label}
            </Link>
          ))}
          {user && (
            <Link
              to="/my-orders"
              className="rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
              activeProps={{ className: "bg-secondary" }}
            >
              طلباتي
            </Link>
          )}
          {isAdmin && (
            <>
              <Link
                to="/admin"
                className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-secondary"
              >
                <Shield className="h-4 w-4" />
                لوحة التحكم
              </Link>
              <Link
                to="/create"
                className="rounded-full px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-secondary"
              >
                إدارة القوالب
              </Link>
            </>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
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
          <Link to="/cart" className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
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
            {user && (
              <Link
                to="/my-orders"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold hover:bg-secondary"
              >
                طلباتي
              </Link>
            )}
            {isAdmin && (
              <>
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 font-semibold text-accent hover:bg-secondary"
                >
                  لوحة التحكم
                </Link>
                <Link
                  to="/create"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 font-semibold text-accent hover:bg-secondary"
                >
                  إدارة القوالب
                </Link>
              </>
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
