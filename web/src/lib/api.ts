export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed");
  return data as T;
}

export const eur = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );

export interface ProductCard {
  id: number;
  slug: string;
  name: string;
  card_title?:string;
  cover_url: string;
  platform: string;
  price_cents: number;
  old_price_cents: number | null;
  currency: string;
  region: string;
  product_type?: string;
  sales_count?: number;
  offer_count?: number;
  offer_id?: number;
  seller?: string;
  discount_pct?: number | null;
}
export interface Offer {
  id: number;
  price_cents: number;
  old_price_cents: number | null;
  region: string;
  region_slug: string;
  seller: string;
  rating: number;
  sales: number;
  stock: number;
}
