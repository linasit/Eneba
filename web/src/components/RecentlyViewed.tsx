import { useTranslation } from "../store/preferences";
import { useQuery } from "@tanstack/react-query";
import { api, type ProductCard } from "../lib/api";
import { useRecentlyViewed } from "../store/recentlyViewed";
import HomeProductCarousel from "./HomeProductCarousel";

export default function RecentlyViewed({title,endpoint,tooltip}:{title:string;endpoint:string;tooltip:string}) {
  const t = useTranslation();
  const slugs = useRecentlyViewed(state => state.slugs);
  const products = useQuery({
    queryKey: ["home", "recently-viewed", slugs],
    queryFn: () => api<ProductCard[]>(`${endpoint}?slugs=${encodeURIComponent(slugs.join(","))}`),
    enabled: slugs.length > 0,
  });
  return <HomeProductCarousel title={title} tooltip={tooltip} kind="recent" products={products.data ?? []} loading={slugs.length > 0 && products.isPending} error={products.isError} empty={t("Products you open will appear here. Find your next game in the store.")}/>;
}
