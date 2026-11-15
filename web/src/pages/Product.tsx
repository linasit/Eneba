import { useTranslation, usePreferences } from "../store/preferences";
import ProductOffers from "../components/ProductOffers";
import FeaturedOffer from "../components/FeaturedOffer";
import IconTooltip from "../components/IconTooltip";
import OfferInfo from "../components/OfferInfo";
import ProductGallery from "../components/ProductGallery";
import HomeProductCarousel from "../components/HomeProductCarousel";
import { useMoney } from "../lib/useMoney";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight, Globe2, KeyRound, ShieldCheck, ShoppingCart, Star, Heart, Check, Monitor, Info, CalendarDays } from "lucide-react";
import { api, ApiError, Offer, type ProductCard } from "../lib/api";
import { useCart } from "../store/cart";
import { useWishlist } from "../store/wishlist";
import { useRecentlyViewed } from "../store/recentlyViewed";
interface Detail {
  id: number; name: string; description: string; cover_url: string;
  developer: string; genres: string[] | null; release_date: string | null; platform: string;
}
export default function Product() {
  const { slug } = useParams();
  return <ProductView key={slug} slug={slug!} />;
}
function ProductView({ slug }: { slug: string }) {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);
  const money = useMoney();
  const navigate = useNavigate();
  const [sort, setSort] = useState("price");
  const [region, setRegion] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  const [tab, setTab] = useState("description");
  const add = useCart(s => s.add);
  const wishlist = useWishlist();
  const recordRecentlyViewed = useRecentlyViewed(s => s.record);
  const product = useQuery({ queryKey: ["product", slug], queryFn: () => api<Detail>(`/products/${slug}`) });
  const offers = useQuery({ queryKey: ["offers", slug, sort], queryFn: () => api<Offer[]>(`/products/${slug}/offers?sort=${sort}`) });
  const related = useQuery({ queryKey: ["home", "recommended"], queryFn: () => api<ProductCard[]>("/home/recommended") });
  useEffect(() => {
    if (product.isSuccess) recordRecentlyViewed(slug);
  }, [product.isSuccess, recordRecentlyViewed, slug]);
  if (product.isPending) return <main className="container product-page"><div className="skeleton" style={{ height: 480 }} aria-label={t("Loading product")} /></main>;
  if (!product.data) return <main className="container product-page empty-state"><h1>{product.error instanceof ApiError && product.error.status === 404 ? t("Product not found") : t("Unable to load this product")}</h1><Link to="/store" className="btn btn-primary">{t("Browse products")}</Link></main>;
  const p = product.data;
  const available = (offers.data ?? []).filter(o => o.stock > 0);
  const list = available.filter(o => !region || o.region_slug === region);
  const best = [...list].sort((a,b) => a.price_cents - b.price_cents)[0];
  const regions = [...new Map((offers.data ?? []).map(o => [o.region_slug, o.region])).entries()];
  const saved = wishlist.items.some(item => item.id === p.id);
  const isGta = slug === "grand-theft-auto-vi-ps5";
  const isGtaProduct = slug.startsWith("grand-theft-auto-vi");
  const platformLabel = p.platform === "Xbox" ? "Xbox Live" : p.platform;
  const title = /key|gift|card/i.test(p.name) ? p.name : `${p.name} (${p.platform === "Xbox" ? "Xbox" : "PC"}) ${p.platform} Key`;
  function purchase(o: Offer, checkout = false, paypal = false) {
    add({ offerId: o.id, productSlug: slug, name: p.name, cover: p.cover_url, seller: o.seller, unitCents: o.price_cents }, !checkout);
    setAdded(o.id); if (checkout) navigate(paypal ? "/checkout?method=paypal" : "/checkout");
  }
  return <main className={`container product-page ${p.platform === "Xbox" ? "product-page-xbox" : ""}`}>
    <nav className="product-breadcrumbs" aria-label={t("Breadcrumb")}><Link to="/">{t("Eneba")}</Link><ChevronRight size={14}/><Link to="/store">{t("Store")}</Link><ChevronRight size={14}/><Link to={`/store?platform=${p.platform === 'PSN' ? 'psn' : p.platform.toLowerCase()}`}>{p.platform}</Link><ChevronRight size={14}/><span>{t(p.name)}</span></nav>
    <div className="product-reference-layout"><div className="product-main-column">
    <div className="product-overview">
      <div className="product-cover-column"><img className="detail-cover" src={p.cover_url} alt={t(p.name)}/></div>
      <section className="product-summary" aria-labelledby="product-title">
        <span className="product-format-badge">{t("Digital edition")}</span>
        <div className="product-title-row"><h1 id="product-title">{t(title)}</h1><button className={`product-wishlist ${saved ? 'is-saved' : ''}`} title={saved ? t("Remove from wishlist") : t("Add to wishlist")} aria-label={saved ? t("Remove from wishlist") : t("Add to wishlist")} aria-pressed={saved} disabled={!best} onClick={() => best && wishlist.toggle({ id:p.id,slug,name:p.name,cover_url:p.cover_url,platform:p.platform,price_cents:best.price_cents,old_price_cents:best.old_price_cents,currency:'EUR',region:best.region,offer_id:best.id,seller:best.seller })}><Heart size={26} fill={saved ? 'currentColor' : 'none'}/></button></div>
        <div className="product-edition-line"><IconTooltip label={t("Digital edition")} className="product-feature-icon"><CalendarDays size={25}/></IconTooltip><span>{isGtaProduct ? <>{t("This is a ")}<a href="https://www.eneba.com/support/article/game-pre-order-information" target="_blank" rel="noopener noreferrer">{t("pre-order")}</a>{t(". Release date ")}<strong>{language === "lt" ? "2026 m. lapkričio 19 d." : "November 19, 2026"}</strong></> : <>{t("Digital edition · ")}<strong>{p.platform}</strong></>}</span></div>
        <p className="product-seller-count"><span/> {available.length} {t(" sellers offering this product")}</p>
        <div className="product-features">
          <div><IconTooltip label={t("Choose an offer that matches your account’s activation region.")} className="product-feature-icon"><Globe2/></IconTooltip><div><strong>{region ? t(regions.find(([s])=>s===region)?.[1]) : regions.map(([,n])=>t(n)).join(" / ") || t("Region availability")}</strong><p>{t("Choose an offer that matches your account’s activation region.")}</p><a href="#product-offers">{t("Check seller regions")}</a></div></div>
          <div>{(p.platform === "PSN" || p.platform === "Xbox") ? <IconTooltip label={t("Activate or redeem on ")+platformLabel} className={`product-platform-icon ${p.platform === "Xbox" ? "platform-xbox" : ""}`}><img src={`/reference/categories/${p.platform === "Xbox" ? "xbox" : "psn"}.svg`} alt=""/></IconTooltip> : <IconTooltip label={p.platform} className="product-feature-icon"><Monitor/></IconTooltip>}<div><strong>{platformLabel}</strong><p>{t("Activate or redeem on ")}{platformLabel}.</p><button className="detail-text-button" onClick={() => {setTab('activation'); document.getElementById('product-details')?.scrollIntoView({behavior:'smooth'});}}>{t("Check activation guide")}</button></div></div>
          <div><IconTooltip label={t("Digital key")} className="product-feature-icon"><KeyRound/></IconTooltip><div><strong>{t("Digital key")}</strong><p>{t("A digital edition. Your test key is delivered to your order after a simulated purchase.")}</p></div></div>
          <div><IconTooltip label={t("Compare independent sellers")} className="product-feature-icon"><ShieldCheck/></IconTooltip><div><strong>{t("Compare independent sellers")}</strong><p>{t("Check each seller’s rating, price, region, and available stock before choosing.")}</p></div></div>
        </div>
        <div className="product-works-on">{t("Works on: ")}<strong>{isGta ? t("PlayStation 5") : p.platform === "Xbox" ? "Xbox Series X" : p.platform}</strong></div>
      </section>

    </div>
    {isGtaProduct && <ProductGallery trailerOnly={!isGta} />}
    <div className="product-notice"><IconTooltip label={t("Important Notice:")} className="product-notice-icon"><Info size={20}/></IconTooltip><div><strong className="product-notice-title">{t("Important Notice:")}</strong>{slug.startsWith("grand-theft-auto-vi") ? <ul className="product-notice-list"><li>{t("Pre-order bonuses may not be included. If included, their content may differ from other offers on the market. Your product key will be delivered when it becomes available after the official release. Delivery times may vary (usually within 3 hours of the official release). More information: ")}<a href="https://www.eneba.com/support/article/game-pre-order-information" target="_blank" rel="noopener noreferrer">{t("how pre-orders work")}</a><br/>{t("For GTA VI pre-orders: digital keys are expected to be delivered on November 19–20, 2026. Due to high global demand across all platforms, delivery may take up to 48 hours.")}</li></ul> : <p>{t(" Compare activation regions carefully. Product and seller information in this store is demonstration data.")}</p>}</div></div>
    <section id="product-offers" className="seller-comparison" aria-labelledby="offer-heading">
      <div className="offer-section-heading"><h2 id="offer-heading">{t("Recommended offers ")}<OfferInfo label={t("About recommended offers")}>{t("The recommended offer is the lowest available price for the selected region. Other sellers are listed below.")}</OfferInfo></h2><div className="offer-filters"><select className="input" aria-label={t("Offer region")} value={region} onChange={e=>setRegion(e.target.value)}><option value="">{t("All regions")}</option>{regions.map(([s,n])=><option key={s} value={s}>{t(n)}</option>)}</select><select className="input" aria-label={t("Sort offers")} value={sort} onChange={e=>setSort(e.target.value)}><option value="price">{t("Lowest price")}</option><option value="rating">{t("Best seller rating")}</option></select></div></div>
      {offers.isError ? <div role="alert">{t("Unable to load offers. ")}<button className="btn btn-ghost" onClick={()=>offers.refetch()}>{t("Try again")}</button></div> : offers.isPending ? <div className="skeleton" style={{height:160}}/> : list.length===0 ? <p className="empty-state">{t("No sellers currently have available keys for this region.")}</p> : <>
        {best && <ProductOffers offers={list} featured={best} cover={p.cover_url} added={added} purchase={purchase} />}
      </>}
      <p className="product-cart-feedback" role="status">{added !== null && <>{t("Offer added to your cart. ")}<Link to="/checkout">{t("View cart")}</Link></>}</p>
    </section>
    <div className="product-related"><HomeProductCarousel tooltip={t("Recommendations based on the products most frequently purchased by our users.")} title="Players also viewed" kind="related" products={(related.data ?? []).filter(item => item.id !== p.id)} loading={related.isPending} error={related.isError}/></div>
    <section className="product-review-summary" aria-label={t("Product reviews")}><h2>{t("Reviews: 0")}</h2><div className="review-summary-panel"><div>{['Gameplay','Story','Graphics','Soundtrack'].map(label=><div className="review-score-row" key={label}><span aria-label={t("Not rated")}>★★★★★</span><span>{t(label)}</span></div>)}</div><p>{t("No reviews yet")}</p></div></section>
    <section id="product-details" className="product-description-section"><h2>{t("Product details")}</h2><div className="product-genre-tags">{(p.genres??[]).map(g=><Link key={g} to={`/store?genre=${encodeURIComponent(g)}`}>{t(g)}</Link>)}</div><div className="product-tabs" role="tablist" aria-label={t("Product information")}>{['description','activation'].map(value=><button key={value} role="tab" id={`tab-${value}`} aria-selected={tab===value} aria-controls="product-information-panel" tabIndex={tab===value ? 0 : -1} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const next=value==='description'?'activation':'description';setTab(next);document.getElementById(`tab-${next}`)?.focus();}}} onClick={()=>setTab(value)}>{value==='description' ? t("Description") : t("Activation guide")}</button>)}</div><div id="product-information-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="product-information-panel">{tab==='description'?<><h3>{t(p.name)}</h3><p>{t(p.description)}</p></>:<><h3>{t("How to activate on ")}{p.platform}</h3><ol><li>{t("Choose an offer compatible with your account’s region and platform.")}</li><li>{t("After checkout, open My orders to view the delivered key.")}</li><li>{t("For real products, redeem a key using your platform’s official redemption screen.")}</li></ol><p>{t("This demo delivers test keys. They cannot be redeemed for real games.")}</p></>}</div><h3>{t("Other details")}</h3><dl className="product-specs"><div><dt>{t("Platform")}</dt><dd>{p.platform}</dd></div><div><dt>{t("Developer")}</dt><dd>{t(p.developer || "Not specified")}</dd></div><div><dt>{t("Release date")}</dt><dd>{p.release_date ? new Date(p.release_date).toLocaleDateString(language === 'lt' ? 'lt-LT' : 'en-IE',{day:'numeric',month:'long',year:'numeric'}) : t("Not specified")}</dd></div><div><dt>{t("Product type")}</dt><dd>{t("Digital key")}</dd></div></dl></section>
    </div>      <FeaturedOffer offer={best} count={list.length} otherPrice={list.length>1 ? Math.min(...list.filter(o=>o.id!==best?.id).map(o=>o.price_cents)) : undefined} added={added} purchase={purchase} loading={offers.isPending} error={offers.isError} /></div>
  </main>;
}
