import { useTranslation } from "../store/preferences";
import { useMoney } from "../lib/useMoney";
import { type MouseEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingCart, Plus, Check } from "lucide-react";
import { ProductCard as P } from "../lib/api";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";
const platformIcon = (p: string) =>
  p === "Rockstar Games Launcher" ? "rockstar" : p === "Roblox" ? "roblox" : p === "Spotify" ? "spotify" : p === "Steam"
    ? "steam"
    : p === "Xbox"
      ? "xbox"
      : p === "PSN" || p === "PlayStation"
        ? "psn"
        : "games";
export default function ProductCard({ p, revealActions = false, cashback }: { p: P; revealActions?: boolean; cashback?:number }) {
  const t = useTranslation();
  const eur = useMoney();
  const pct = p.old_price_cents
    ? Math.round(
        (100 * (p.old_price_cents - p.price_cents)) / p.old_price_cents,
      )
    : 0;
  const saved = useWishlist((s) => s.items.some((x) => x.id === p.id)),
    toggle = useWishlist((s) => s.toggle),
    add = useCart((s) => s.add),
    nav = useNavigate();
  const [added, setAdded] = useState(false);
  const title = p.card_title ?? p.name;
  const platformStrip = <div className="platform-strip"><img src={`/reference/categories/${platformIcon(p.platform)}.svg`} alt=""/>{t(p.platform)}</div>;
  function buy(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus({ preventScroll: true });
    if (!p.offer_id) {
      nav(`/p/${p.slug}`);
      return;
    }
    add({
      offerId: p.offer_id,
      productSlug: p.slug,
      name: p.name,
      cover: p.cover_url,
      seller: p.seller ?? "GameNest",
      unitCents: p.price_cents,
    });
    setAdded(true);
  }
  return (
    <article className={`card product-card ${revealActions ? "has-hover-actions" : ""}`}>
      <Link
        to={`/p/${p.slug}`}
        className="cover-wrap"
        tabIndex={-1}
        aria-hidden="true"
      >
        <img src={p.cover_url} alt="" loading="lazy" />
        {cashback&&<span className="cheap-cashback-badge">⊕ {t("Cashback")}</span>}
        {!revealActions && platformStrip}
      </Link>
      <div className="product-card-body">
      {revealActions && platformStrip}
      <div className="product-info">
        <Link to={`/p/${p.slug}`} className="product-title">
          <h3 title={t(title)}>{t(title)}</h3>
        </Link>
        <div
          className={`region-label ${p.region === "Global" ? "global-region" : ""}`}
        >
          {t(p.region)}
        </div>
        <div className="card-pricing">
          <div className="product-price-heading">
          <div className="price-label">{t("From")}</div>
          <div className="price-reduction">
            {p.old_price_cents && (
              <span className="price-old">{eur(p.old_price_cents)}</span>
            )}
            {pct > 0 && <span className="discount-pct">−{pct}%</span>}
          </div>
          </div>
          <Link to={`/p/${p.slug}`} className="price">
            {eur(p.price_cents)}
          </Link>
          <div className="delivery-note">{cashback?`${cashback}% ${t("back")}`:t("Instant digital delivery")}</div>
        </div>
        {!revealActions && <button
          className="quick-buy"
          onClick={buy}
          aria-label={added ? t("{0} added to cart", {0: p.name}) : t("Add {0} to cart", {0: p.name})}
        >
          {added ? (
            <Check size={20} />
          ) : (
            <>
              <Plus size={14} />
              <ShoppingCart size={20} />
            </>
          )}
        </button>}
      </div>
      {revealActions && <div className="product-hover-actions">
        <button className="product-hover-cart" onClick={buy} aria-label={added ? t("{0} added to cart", {0: p.name}) : t("Add {0} to cart", {0: p.name})}>{added ? <> <Check size={18} /> {t("Added to cart")}</> : t(cashback?"Add product to cart":"Add to cart")}</button>
        <Link className="product-hover-offers" to={`/p/${p.slug}`}>{t("View offers")}<span className="sr-only"> {t(" for ")}{t(p.name)}</span></Link>
      </div>}
      </div>
      <button
        className={`wishlist-toggle ${saved ? "is-saved" : ""}`}
        aria-label={t(saved ? "Remove {0} from wishlist" : "Save {0} to wishlist", {0:t(p.name)})}
        aria-pressed={saved}
        onClick={() => toggle(p)}
      >
        <Heart size={21} fill={saved ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
