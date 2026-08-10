import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UiLang = "ar" | "en";

const STORAGE_KEY = "kidzy.uiLang";

/** قاموس الترجمة لواجهة الموقع (عربي ↔ إنجليزي) */
const DICT: Record<string, { ar: string; en: string }> = {
  "nav.home": { ar: "الرئيسية", en: "Home" },
  "nav.stories": { ar: "القصص", en: "Stories" },
  "nav.books": { ar: "كتب", en: "Books" },
  "nav.games": { ar: "ألعاب", en: "Games" },
  "nav.puzzles": { ar: "ألغاز", en: "Puzzles" },
  "nav.create": { ar: "أنشئ قصة", en: "Create a Story" },
  "nav.children": { ar: "أطفالي", en: "My Children" },
  "nav.orders": { ar: "طلباتي", en: "My Orders" },
  "nav.favorites": { ar: "المفضلة", en: "Favorites" },
  "nav.rewards": { ar: "مكافآتي", en: "My Rewards" },
  "nav.referrals": { ar: "ادعُ صديقاً", en: "Invite a Friend" },
  "nav.admin": { ar: "لوحة التحكم", en: "Admin" },
  "nav.cart": { ar: "السلة", en: "Cart" },
  "nav.menu": { ar: "القائمة", en: "Menu" },
  "auth.signIn": { ar: "تسجيل الدخول", en: "Sign in" },
  "auth.signOutShort": { ar: "خروج", en: "Sign out" },
  "auth.signOut": { ar: "تسجيل الخروج", en: "Sign out" },
  "lang.toggle": { ar: "English", en: "العربية" },
  "lang.toggleAria": { ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" },
  "story.showEnglish": { ar: "English", en: "العربية" },
  "story.langHint": {
    ar: "عرض نص القصة بالإنجليزية",
    en: "Show the story text in Arabic",
  },
};

type LanguageContextValue = {
  lang: UiLang;
  dir: "rtl" | "ltr";
  setLang: (l: UiLang) => void;
  toggleLang: () => void;
  t: (key: keyof typeof DICT | string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("ar");

  // القراءة من التخزين المحلي بعد الترطيب فقط لتفادي اختلاف SSR
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ar") setLangState(saved);
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  // ترجمة كل نصوص الصفحة تلقائيًا عند اختيار الإنجليزية
  useEffect(() => {
    if (lang !== "en") return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/domTranslate").then(({ startDomTranslation }) =>
      startDomTranslation().then((stop) => {
        if (cancelled) stop();
        else cleanup = stop;
      }),
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [lang]);

  const setLang = useCallback((l: UiLang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* التخزين غير متاح */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang,
      toggleLang: () => setLang(lang === "ar" ? "en" : "ar"),
      t: (key: string) => DICT[key]?.[lang] ?? key,
    }),
    [lang, setLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // احتياط آمن إن استُخدم الخطاف خارج المزوّد
    return {
      lang: "ar",
      dir: "rtl",
      setLang: () => {},
      toggleLang: () => {},
      t: (key: string) => DICT[key]?.ar ?? key,
    };
  }
  return ctx;
}
