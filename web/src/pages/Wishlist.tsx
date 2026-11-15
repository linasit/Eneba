import { useQueries } from '@tanstack/react-query';
import { api, type ProductCard as Product } from '../lib/api';
import StoreSort from '../components/StoreSort';
import { usePreferences } from '../store/preferences';
import { localeFor } from '../lib/localeOptions';
import { facetLabels } from '../components/StoreFilters';
import { useState } from 'react';
import { Bell, Heart, Search, ChevronDown } from 'lucide-react';
import { useTranslation } from '../store/preferences';
import { Link } from 'react-router-dom';
import { useWishlist } from '../store/wishlist';
import { useAuth } from '../store/auth';
import ProductCard from '../components/ProductCard';
import GenreCategories from '../components/GenreCategories';
export default function Wishlist() {
 const t=useTranslation();const items=useWishlist(s=>s.items);const {user}=useAuth();const [search,setSearch]=useState('');const [sort,setSort]=useState('newest');const [kinds,setKinds]=useState<string[]>([]);const language=usePreferences(s=>s.language);
 const metadata=useQueries({queries:items.map(item=>({queryKey:['product',item.slug],queryFn:()=>api<Product>(`/products/${item.slug}`),staleTime:60000}))});
 const enriched=items.map((item,index)=>({...item,product_type:metadata[index]?.data?.product_type??item.product_type??'other',sales_count:metadata[index]?.data?.sales_count??item.sales_count??0,added:index}));
 const searched=enriched.filter(item=>`${t(item.name)} ${item.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 const typeCounts=[...new Set(enriched.map(item=>item.product_type))].map(kind=>({kind,count:searched.filter(item=>item.product_type===kind).length}));
 const matches=searched.filter(item=>!kinds.length||kinds.includes(item.product_type)).sort((a,b)=>{
  if(sort==='price_asc')return a.price_cents-b.price_cents;
  if(sort==='price_desc')return b.price_cents-a.price_cents;
  if(sort==='oldest')return a.added-b.added;
  if(sort==='popular')return b.sales_count-a.sales_count;
  if(sort==='name_asc')return t(a.name).localeCompare(t(b.name),localeFor(language));
  if(sort==='name_desc')return t(b.name).localeCompare(t(a.name),localeFor(language));
  return b.added-a.added;
 });
 return <main className="container wishlist-page"><div className="wishlist-heading"><h1>{t('Wishlist')}</h1><p><Bell size={22}/><span>{user?t('Your wishlist is saved on this device. Email alerts are not sent in this demo.'):<>{t('Set email notifications when the price is down for any of your Wishlisted products.')} <Link to="/login">{t('Log in')}</Link> {t('or')} <Link to="/login?mode=register">{t('Register')}</Link></>}{!user&&<small className="wishlist-demo-note">{t("Demo: email price alerts are not available.")}</small>}</span></p></div><div className="wishlist-layout"><aside className="wishlist-sidebar"><div className="wishlist-search"><label htmlFor="wishlist-search">{t('Product name')}</label><div><input id="wishlist-search" type="search" value={search} onChange={event=>setSearch(event.target.value)} aria-label={t('Search wishlist')}/><Search size={20}/></div></div>{items.length>0&&<details className="wishlist-kind-filter" open><summary>{t("Kind")}<ChevronDown size={18}/></summary>{typeCounts.map(({kind,count})=><label key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={()=>setKinds(current=>current.includes(kind)?current.filter(value=>value!==kind):[...current,kind])}/><span>{t(kind==='games'?'Games':facetLabels[kind]??'Other')}</span><span>{count}</span></label>)}</details>}</aside><section className="wishlist-results" aria-label={t('Wishlisted products')}>{items.length>0&&<div className="wishlist-results-toolbar"><p role="status">{t("Search results: {0}",{0:matches.length})}</p><StoreSort value={sort} onChange={setSort}/></div>}{matches.length?<div className="wishlist-product-grid">{matches.map(product=><ProductCard key={product.id} p={product} revealActions/>)}</div>:<div className="wishlist-reference-empty"><div className="wishlist-ribbon"><Heart size={36} strokeWidth={1.5}/></div><p>{t(items.length?'No wishlisted products match your search.':"You don't have wishlisted products yet.")}</p><strong>{t(items.length?'Try a different product name.':'Add products to Wishlist and they will appear here.')}</strong></div>}</section></div><GenreCategories endpoint="/home/genres" title={t("Categories")}/></main>;
}
