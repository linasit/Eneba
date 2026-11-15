import { useTranslation } from "../store/preferences";
import { type ProductCard as Product } from "../lib/api";
import OfferInfo from "./OfferInfo";
import ProductCard from "./ProductCard";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
export type GiftBrand = {label:string;image_url:string;href:string};
export default function GiftCardCarousel({ title, tooltip, showAll, brands = [], products, loading, error }: { title: string; tooltip:string; showAll:string; brands?: GiftBrand[]; products?: Product[]; loading?: boolean; error?: boolean }) {
  const t = useTranslation();
  const rail = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setEnds({ start: element.scrollLeft < 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(element); update();
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [products?.length, brands.length]);
  const move = (direction: number) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <section className={`gift-card-carousel ${products ? "gift-product-carousel" : ""}`} aria-label={t(title)} aria-roledescription="carousel">
    <div className="gift-carousel-heading"><h2>{t(title)}</h2><OfferInfo label={t("About {0}", {0:t(title)})}>{tooltip}</OfferInfo></div>
    {loading && <p role="status">{t("Loading gift cards…")}</p>}
    {error && <p role="alert">{t("Could not load gift cards. Please refresh to try again.")}</p>}
    <div className="gift-carousel-window">
      <button className="gift-carousel-arrow gift-carousel-prev" aria-label={t("Previous {0}", {0: title})} disabled={ends.start} onClick={() => move(-1)}><ChevronLeft size={25} /></button>
      <div className="gift-carousel-track" ref={rail} tabIndex={0} aria-label={t(products ? "{0} products" : "{0} brands", {0:title})} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
        {products?.map(product => <ProductCard key={product.id} p={product} revealActions />)}
        {brands.map(brand => <Link key={brand.label} to={brand.href} title={brand.label}>
          <img src={brand.image_url} alt={brand.label} loading="lazy" width="300" height="420" />
        </Link>)}
      </div>
      <button className="gift-carousel-arrow gift-carousel-next" aria-label={t("Next {0}", {0: title})} disabled={ends.end} onClick={() => move(1)}><ChevronRight size={25} /></button>
    </div>
    <Link className="gift-carousel-show-all" to={showAll} aria-label={t("Show all {0}", {0: title})}>{t("Show all")}</Link>
  </section>;
}
