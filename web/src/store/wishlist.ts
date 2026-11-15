import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductCard } from "../lib/api";
export const useWishlist = create<{
  items: ProductCard[];
  toggle: (p: ProductCard) => void;
}>()(
  persist(
    (set) => ({
      items: [],
      toggle: (p) =>
        set((s) => ({
          items: s.items.some((x) => x.id === p.id)
            ? s.items.filter((x) => x.id !== p.id)
            : [...s.items, p],
        })),
    }),
    { name: "eneba-wishlist", version: 1 },
  ),
);
