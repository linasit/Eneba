import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { type ProductCard as Product } from "../lib/api";
import { useTranslation } from "../store/preferences";
import OfferInfo from "./OfferInfo";
import ProductCard from "./ProductCard";

type Props = {
  title: string;
  tooltip:string;
  kind: string;
  products: Product[];
  loading?: boolean;
  error?: boolean;
  showAll?: string;
  empty?: string;
  cashback?:number;
};
export default function HomeProductCarousel({ title, tooltip, kind, products, loading, error, showAll, empty, cashback }: Props) {
  const t = useTranslation();
  const id = useId();
  const rail = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: 0, max: 0, visible: 100 });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => setScroll({ left: element.scrollLeft, max: Math.max(0, element.scrollWidth - element.clientWidth), visible: element.clientWidth / element.scrollWidth * 100 });
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update); observer.observe(element); update();
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [products.length, loading]);
  const move = (direction: number) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <section className={`product-section homepage-product-row product-row-${kind}`} aria-labelledby={id} aria-roledescription="carousel">
    <div className="section-heading"><h2 id={id}>{t(title)}</h2>{tooltip&&<OfferInfo label={t("About {0}", {0:t(title)})}>{tooltip}</OfferInfo>}</div>
    {error ? <p role="alert">{t("This section could not be loaded. Please refresh.")}</p> : !loading && products.length === 0 ? <div className="recently-viewed-empty"><p>{t(empty ?? "No products are available right now.")}</p><Link to="/store">{t("Browse products")}<ChevronRight size={17}/></Link></div> : <div className="home-product-window">
      <button className="home-product-arrow home-product-prev" aria-label={t("Previous {0}", {0: t(title)})} disabled={scroll.left < 2 || loading} onClick={() => move(-1)}><ChevronLeft size={25}/></button>
      <div className="home-product-track" ref={rail} tabIndex={0} aria-label={t("{0} products", {0: t(title)})} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "ArrowRight" || event.key === "ArrowLeft")) { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
        {loading ? Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton home-product-skeleton" aria-label={t("Loading product")}/>) : products.map(product => <ProductCard key={product.id} p={product} revealActions cashback={cashback}/>)}
      </div>
      <button className="home-product-arrow home-product-next" aria-label={t("Next {0}", {0: t(title)})} disabled={scroll.left >= scroll.max - 2 || loading} onClick={() => move(1)}><ChevronRight size={25}/></button>
      {(kind === "upcoming" || kind === "cheap") && scroll.max > 0 && <input className="home-product-position" type="range" min={0} max={scroll.max} value={scroll.left} aria-label={t("{0} carousel position", {0: t(title)})} style={{ "--carousel-thumb-width": `${scroll.visible}%` } as CSSProperties} onChange={event => rail.current?.scrollTo({ left: Number(event.target.value), behavior: "instant" })} onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); }
        if (event.key === "Home" || event.key === "End") { event.preventDefault(); rail.current?.scrollTo({ left: event.key === "Home" ? 0 : scroll.max, behavior: "instant" }); }
      }}/>}
    </div>}
    {showAll && <Link className="home-product-show-all" to={showAll}>{kind === "recommended" ? t("See all") : kind === "cheap" ? t("Show everything") : t("Show all")}</Link>}
  </section>;
}
