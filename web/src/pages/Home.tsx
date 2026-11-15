import { useTranslation, usePreferences } from '../store/preferences';
import { useQuery } from '@tanstack/react-query';
import { api, ProductCard as P } from '../lib/api';
import GenreCategories from '../components/GenreCategories';
import HomeProductCarousel from '../components/HomeProductCarousel';
import RecentlyViewed from '../components/RecentlyViewed';
import CategoryCarousel from '../components/CategoryCarousel';
import PromoCarousel from '../components/PromoCarousel';
import GiftCardCarousel, { type GiftBrand } from '../components/GiftCardCarousels';
interface Block { id:number; type:string; title:string; config:{endpoint:string;show_all:string;tooltip:string;tooltip_lt:string;title_lt:string;kind:string} }
function ContentBlock({block}:{block:Block}) {
 const language=usePreferences(s=>s.language);
 const c=block.config;
 const title=language==='lt'?c.title_lt:block.title;
 const tooltip=language==='lt'?c.tooltip_lt:c.tooltip;
 if(block.type==='banner')return <PromoCarousel endpoint={c.endpoint}/>;
 if(block.type==='categories')return <CategoryCarousel endpoint={c.endpoint} title={title}/>;
 if(block.type==='recent')return <RecentlyViewed title={title} endpoint={c.endpoint} tooltip={tooltip}/>;
 if(block.type==='genres')return <GenreCategories endpoint={c.endpoint} title={title}/>;
 return <DataRow block={block} title={title} tooltip={tooltip}/>;
}
function DataRow({block,title,tooltip}:{block:Block;title:string;tooltip:string}) {
 const c=block.config;
 const q=useQuery({queryKey:['home','content',c.endpoint],queryFn:()=>api<P[]|GiftBrand[]>(c.endpoint)});
 if(c.kind==='brands')return <GiftCardCarousel title={title} tooltip={tooltip} brands={(q.data??[]) as GiftBrand[]} showAll={c.show_all} loading={q.isPending} error={q.isError}/>;
 if(c.kind==='gifts')return <GiftCardCarousel title={title} tooltip={tooltip} products={(q.data??[]) as P[]} showAll={c.show_all} loading={q.isPending} error={q.isError}/>;
 return <HomeProductCarousel title={title} tooltip={tooltip} kind={c.kind} products={(q.data??[]) as P[]} loading={q.isPending} error={q.isError} showAll={c.show_all}/>;
}
export default function Home() {
 const t=useTranslation();
 const q=useQuery({queryKey:['home','layout'],queryFn:()=>api<Block[]>('/home/layout')});
 return <main className="home reference-home"><div className="home-sections">{q.isPending?<div className="campaign-skeleton skeleton"/>:q.isError?<div className="container empty-state"><h1>{t('We couldn’t load the store')}</h1><button className="btn btn-primary" onClick={()=>q.refetch()}>{t('Try again')}</button></div>:q.data.map(block=><div key={block.id} className={block.type==='banner'?'home-banner-block':block.type==='upcoming'?'home-upcoming-block':'container'}>{block.type==='upcoming'?<div className="container"><ContentBlock block={block}/></div>:<ContentBlock block={block}/>}</div>)}</div></main>;
}
