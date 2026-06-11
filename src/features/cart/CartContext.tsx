import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface CartItem {
  templateId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  contentType: "story" | "book";
}

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (templateId: string) => void;
  clear: () => void;
  count: number;
  totalEgp: number;
  has: (templateId: string) => boolean;
}

const STORAGE_KEY = "hakayati_cart_v1";
export const PRICE_PER_ITEM_EGP = 100;

const CartCtx = createContext<CartState | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i: unknown): i is CartItem =>
        !!i &&
        typeof i === "object" &&
        "templateId" in i &&
        "title" in i,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) =>
      prev.some((p) => p.templateId === item.templateId) ? prev : [...prev, item],
    );
  }, []);
  const remove = useCallback((templateId: string) => {
    setItems((prev) => prev.filter((p) => p.templateId !== templateId));
  }, []);
  const clear = useCallback(() => setItems([]), []);
  const has = useCallback(
    (templateId: string) => items.some((i) => i.templateId === templateId),
    [items],
  );

  const value = useMemo<CartState>(
    () => ({
      items,
      add,
      remove,
      clear,
      has,
      count: items.length,
      totalEgp: items.length * PRICE_PER_ITEM_EGP,
    }),
    [items, add, remove, clear, has],
  );

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartCtx);
  if (!ctx) {
    // safe fallback so SSR / missing-provider doesn't crash
    return {
      items: [],
      add: () => {},
      remove: () => {},
      clear: () => {},
      has: () => false,
      count: 0,
      totalEgp: 0,
    };
  }
  return ctx;
}
