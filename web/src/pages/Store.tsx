import { useTranslation } from "../store/preferences";
import StoreSort from "../components/StoreSort";
import StoreGuide from "../components/StoreGuide";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { api, ProductCard as P } from "../lib/api";
import ProductCard from "../components/ProductCard";
import StoreFilters, { type Facet, type FilterSetter, countries, filterNames, facetLabels } from "../components/StoreFilters";

export default function Store() {
  const t = useTranslation();
  const [sp,setSp] = useSearchParams();
  const [filtersOpen,setFiltersOpen] = useState(false);
  const set:FilterSetter = (key,value)=>setSp(current=>{ const next=new URLSearchParams(current); const resolved=typeof value==="function"?value(current.get(key)??""):value; resolved?next.set(key,resolved):next.delete(key); if(key!=="page")next.delete("page"); return next; });
  const facets=useQuery({queryKey:["catalog","filters"],queryFn:()=>api<Facet[]>("/catalog/filters")});
  const {data,isFetching,isError}=useQuery({queryKey:["store",sp.toString()],placeholderData:keepPreviousData,queryFn:()=>api<{items:P[];page:number;pageSize:number;total:number}>(`/products?${sp.toString()}`)});
  const categories=useQuery({queryKey:["home","categories"],queryFn:()=>api<{slug:string;label:string}[]>("/home/categories")});
  const page=Number(sp.get("page")??1);
  const active=Array.from(sp.entries()).filter(([key])=>key in filterNames).flatMap(([key,value])=>value.split(",").filter(Boolean).map(value=>({key,value,label:(key==="type"?facetLabels[value]:undefined) ?? facets.data?.find(f=>f.facet===key&&f.value.toLowerCase()===value.toLowerCase())?.label ?? (key==="country"?countries.find(([v])=>v===value)?.[1]:undefined) ?? value})));
  const clear=()=>{const next=new URLSearchParams(sp); Object.keys(filterNames).forEach(key=>next.delete(key));next.delete("page");setSp(next);};
  const remove=(key:string,value:string)=>set(key,(sp.get(key)??"").split(",").filter(v=>v!==value).join(","));
  return <div className="container store-layout reference-store">
    <button className="store-mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="store-filters" onClick={()=>setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18}/>{t("Sort and filter")}{active.length>0?` (${active.length})`:""}<ChevronDown size={18}/></button>
    <aside id="store-filters" className={`store-filters ${filtersOpen?"filters-expanded":""}`} aria-label={t("Product filters")}>
      {facets.isError&&<p role="alert">{t("Could not load filter counts. Refresh to try again.")}</p>}
      <StoreFilters facets={facets.data??[]} params={sp} set={set} clear={clear}/>
      <p className="filter-count-note">{t("Counts show available products in this demo catalog. Price filters use EUR.")}</p>
    </aside>
    <main aria-busy={isFetching}>
      <h1>{sp.get("q") ? t("Results for “{0}”", {0: sp.get("q")}) : t(categories.data?.find(c=>c.slug===sp.get("category"))?.label ?? "Games, gift cards and more")}</h1>
      <div className="store-results-toolbar"><p role="status">{data ? t("Results found: {0}", {0: data.total}) : t("Loading products…")}</p><StoreSort value={sp.get("sort")??"popular"} onChange={value=>set("sort",value)}/></div>
      {active.length>0&&<div className="store-active-filters" aria-label={t("Selected filters")}>{active.map(({key,value,label})=><button key={`${key}-${value}`} onClick={()=>remove(key,value)} aria-label={t("Remove {0}: {1}", {0: t(filterNames[key]), 1: t(label)})}>{key==="min" ? t("From €") : key==="max" ? t("To €") : ""}{t(label)}<X size={14}/></button>)}<button className="clear-active" onClick={clear}>{t("Clear all")}</button></div>}
      {isError&&<p role="alert">{t("Unable to load products. Please refresh.")}</p>}
      <div className="grid" style={{opacity:isFetching?0.6:1}}>{data?.items.map(product=><ProductCard key={product.id} p={product} revealActions/>)}</div>
      {data?.items.length===0&&<div className="store-empty"><h2>{t("No products match your filters")}</h2><p>{t("Try removing a filter or changing the price range.")}</p><button className="btn btn-primary" onClick={clear}>{t("Clear filters")}</button></div>}
      <nav className="store-pagination" aria-label={t("Product pages")}><button className="btn btn-ghost" disabled={page<=1||isFetching} onClick={()=>set("page",String(page-1))}>{t("← Prev")}</button><span>{t("Page ")}{page}</span><button className="btn btn-ghost" disabled={!data||page*data.pageSize>=data.total||isFetching} onClick={()=>set("page",String(page+1))}>{t("Next →")}</button></nav>
    </main>
    <StoreGuide />
  </div>;
}
