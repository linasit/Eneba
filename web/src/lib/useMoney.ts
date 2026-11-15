import { localeFor } from "./localeOptions";
import { useQuery } from "@tanstack/react-query";
import { usePreferences } from "../store/preferences";
export function useMoney() {
  const currency = usePreferences(s => s.currency);
  const language = usePreferences(s => s.language);
  const { data } = useQuery({
    queryKey: ["exchange-rate", currency], enabled: currency !== "EUR", staleTime: 3600000, retry: 1,
    initialData: () => { try { const value = JSON.parse(sessionStorage.getItem(`eneba-rate-${currency}`) ?? 'null'); return value?.rate > 0 ? value : undefined; } catch { return undefined; } },
    queryFn: async () => {
      const response = await fetch(`https://api.frankfurter.dev/v2/rate/eur/${currency.toLowerCase()}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Rate unavailable");
      const result = await response.json(); if (!(result.rate > 0)) throw new Error("Invalid rate"); return result as { rate: number };
    },
  });
  return (cents: number) => new Intl.NumberFormat(localeFor(language), { style: "currency", currency: currency === "EUR" || !data ? "EUR" : currency }).format(cents / 100 * (currency === "EUR" || !data ? 1 : data.rate));
}
