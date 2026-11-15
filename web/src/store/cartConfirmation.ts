import { create } from "zustand";

export const useCartConfirmation = create<{ open: boolean; show(): void; close(): void }>(set => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));
