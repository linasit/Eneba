import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentlyViewed {
  slugs: string[];
  record: (slug: string) => void;
}

export const useRecentlyViewed = create<RecentlyViewed>()(
  persist(
    (set) => ({
      slugs: [],
      record: (slug) => {
        if (!slug) return;
        set((state) => {
          if (state.slugs[0] === slug) return state;
          return {
            slugs: [slug, ...state.slugs.filter((item) => item !== slug)].slice(0, 12),
          };
        });
      },
    }),
    { name: "eneba-recently-viewed", version: 1 },
  ),
);
