import { useTranslation, usePreferences } from "../store/preferences";
import { Check, KeyRound, Plus, ShieldCheck, ShoppingCart, Star } from "lucide-react";
import type { Offer } from "../lib/api";
import { useMoney } from "../lib/useMoney";
import OfferInfo from "./OfferInfo";
type Props = { offers: Offer[]; featured: Offer; cover: string; added: number | null; purchase: (offer: Offer, checkout?: boolean, paypal?: boolean) => void };
export default function ProductOffers({ offers, featured, cover, added, purchase }: Props) {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);
  const money = useMoney();
  const recommended = [featured];
  const remaining = offers.filter(o=>o.id!==featured.id);
  const lowest = Math.min(...offers.map(o=>o.price_cents));
  function row(o: Offer, isFeatured = false) {
    return <article className={`reference-offer-row ${isFeatured ? 'reference-offer-featured' : ''}`} key={o.id}>
      <div className="reference-seller"><span className="reference-seller-avatar">{isFeatured ? <img src={cover} alt=""/> : o.seller.charAt(0)}</span><div><h3>{isFeatured ? t("Featured offer") : o.seller}</h3><div className="reference-seller-subtitle">{isFeatured ? <><ShieldCheck size={18}/><span>{t("Sold by ")}{o.seller}</span><OfferInfo label={t("About the featured offer")}>{t("The lowest-priced available offer for the selected region, sold by ")}{o.seller}{t(". This is a demo listing, not an Eneba-verified seller.")}</OfferInfo></> : <><Star size={18} fill="currentColor"/><span><b>{o.rating.toFixed(2)}</b> {t(" / 5 seller rating")}</span><OfferInfo label={t("About {0}'s rating", {0: o.seller})}>{o.sales.toLocaleString(language)} {t(" sales in the demo catalog. Seller ratings are demonstration data.")}</OfferInfo></>}</div></div></div>
      <div className="reference-offer-price"><div><strong>{money(o.price_cents)}</strong><OfferInfo label={t("Price details for {0}", {0: o.seller})}>{t("The cart price is ")}{new Intl.NumberFormat(language === 'lt' ? 'lt-LT' : 'en-IE',{style:'currency',currency:'EUR'}).format(o.price_cents/100)}{t(". Currency conversions are estimates. No real payment is taken in this demo.")}</OfferInfo></div>{o.price_cents===lowest && <span className="reference-lowest-badge">{t("Lowest price")}</span>}<span className="reference-offer-stock"><KeyRound size={15}/>{t("Keys in stock: {0}",{0:o.stock})}</span><small>{t(o.region)}</small></div>
      <div className="offer-action-group">
        <button className="reference-offer-buy offer-action-trigger" onClick={()=>purchase(o,true)} aria-label={t("Buy offer from {0}", {0: o.seller})}>{t("Buy now")}</button>
        <div className="offer-action-reveal">
          <button className="reference-paypal" aria-label={t("Buy {0} offer with PayPal demo", {0: o.seller})} onClick={()=>purchase(o,true,true)}><img src="/reference/footer/braintree_paypal.svg" alt={t("PayPal")}/></button>
          <button className="reference-cart-button" onClick={()=>purchase(o)} aria-label={t("Add {0} offer to cart", {0: o.seller})}>{added===o.id ? <Check size={21}/> : <><Plus size={15}/><ShoppingCart size={22}/></>}</button>
        </div>
      </div>
    </article>;
  }
  return <><div className="reference-offer-rows">{recommended.map(o=>row(o,o.id===featured.id))}</div><h3 className="reference-other-heading">{t("Other offers: {0}",{0:remaining.length})} <OfferInfo label={t("About other offers")}>{t("Additional available seller offers for this product. Use the region and sorting controls to compare.")}</OfferInfo></h3>{remaining.length ? <div className="reference-offer-rows">{remaining.map(o=>row(o))}</div> : <p className="no-other-offers">{t("All available sellers are shown above.")}</p>}</>;
}
