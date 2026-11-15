import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCartConfirmation } from "./cartConfirmation";

export interface CartLine {
  offerId: number;
  productSlug: string;
  name: string;
  cover: string;
  seller: string;
  unitCents: number;
  qty: number;
}
interface CartState {
  lines: CartLine[];
  add(l: Omit<CartLine, "qty">, confirm?: boolean): void;
  setQty(offerId: number, qty: number): void;
  remove(offerId: number): void;
  clear(): void;
  total(): number;
}
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (l, confirm = true) => {
        const previousQty = get().lines.find(x => x.offerId === l.offerId)?.qty ?? 0;
        set(({ lines }) => {
          const found = lines.find((x) => x.offerId === l.offerId);
          return {
            lines: found
              ? lines.map((x) =>
                  x.offerId === l.offerId
                    ? { ...x, qty: Math.min(5, x.qty + 1) }
                    : x,
                )
              : [...lines, { ...l, qty: 1 }],
          };
        });
        if (confirm && previousQty < 5) useCartConfirmation.getState().show();
      },
      setQty: (id, qty) =>
        set(({ lines }) => ({
          lines: lines.map((x) =>
            x.offerId === id
              ? {
                  ...x,
                  qty: Number.isFinite(qty)
                    ? Math.max(1, Math.min(5, Math.floor(qty)))
                    : 1,
                }
              : x,
          ),
        })),
      remove: (id) =>
        set(({ lines }) => ({ lines: lines.filter((x) => x.offerId !== id) })),
      clear: () => set({ lines: [] }),
      total: () => get().lines.reduce((s, l) => s + l.unitCents * l.qty, 0),
    }),
    { name: "kv-cart" },
  ),
);
