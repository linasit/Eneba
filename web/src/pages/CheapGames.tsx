import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type ProductCard as Product } from '../lib/api';
import { usePreferences, useTranslation } from '../store/preferences';
import ProductCard from '../components/ProductCard';
import HomeProductCarousel from '../components/HomeProductCarousel';
type Section={slug:string;config:{title:string;title_lt:string;endpoint:string;show_all:string;layout:string;cashback_percent:number}};
type Trustpilot={href:string;review_count:string;score:number;brand:string;label:string};
type Hero={trustpilot?:Trustpilot;title:string;title_lt:string;description:string;description_lt:string;cta:string;cta_lt:string;href:string;note:string;note_lt:string;image:string};
function PromotionSection({section}:{section:Section}) {
 const lt=usePreferences(s=>s.language)==='lt';const t=useTranslation();const c=section.config;
 const q=useQuery({queryKey:['promotion','cheap-games',section.slug],queryFn:()=>api<Product[]>(c.endpoint)});
 const title=lt?c.title_lt:c.title;
 if(c.layout!=='grid')return <section className="cheap-band" data-promotion-section={section.slug}><div className="container"><HomeProductCarousel title={title} tooltip="" kind="cheap" products={q.data??[]} loading={q.isPending} error={q.isError} showAll={c.show_all} cashback={c.cashback_percent}/></div></section>;
 return <section id="cheap-popular" className="container cheap-popular"><h2>{title}</h2>{q.isError?<p role="alert">{t('Unable to load products. Please refresh.')}</p>:q.isPending?<div className="skeleton cheap-loading"/>:<div className="cheap-product-grid">{q.data?.map(p=><ProductCard key={p.id} p={p} revealActions cashback={c.cashback_percent}/>)}</div>}<Link className="home-product-show-all" to={c.show_all}>{t('Show all')}</Link></section>;
}
function TrustpilotStrip({badge}:{badge:Trustpilot}) {
 return <section className="cheap-trustpilot"><a href={badge.href} target="_blank" rel="noopener noreferrer" aria-label={badge.label} title={badge.label}><span>Check out Eneba’s <strong>{badge.review_count} reviews</strong></span><span className="cheap-trustpilot-stars" role="img" aria-label={`${badge.score} out of 5 stars`}>{Array.from({length:5},(_,i)=><span key={i} style={{background:`linear-gradient(to right, #00b67a ${Math.max(0,Math.min(1,badge.score-i))*100}%, #dcdce6 0)`}} aria-hidden="true">★</span>)}</span><span className="cheap-trustpilot-brand"><span aria-hidden="true">★</span>{badge.brand}</span></a></section>;
}
export default function CheapGames(){
 const lt=usePreferences(s=>s.language)==='lt';const t=useTranslation();
 const q=useQuery({queryKey:['promotion','cheap-games'],queryFn:()=>api<{hero:Hero;sections:Section[]}>('/promotions/cheap-games')});
 if(q.isPending)return <main className="container cheap-games"><div className="skeleton cheap-loading"/></main>;
 if(q.isError)return <main className="container empty-state"><h1>{t('We couldn’t load the store')}</h1><button className="btn btn-primary" onClick={()=>q.refetch()}>{t('Try again')}</button></main>;
 const h=q.data.hero;
 return <main className="cheap-games"><section className="cheap-hero"><div className="container cheap-hero-content"><div><h1>{lt?h.title_lt:h.title}</h1><p>{lt?h.description_lt:h.description}</p><a className="cheap-save" href={h.href}>{lt?h.cta_lt:h.cta}</a><p className="cheap-hero-note">{lt?h.note_lt:h.note}</p></div><img src={h.image} alt="" width="600" height="400"/></div></section>{q.data.sections.map(section=><PromotionSection key={section.slug} section={section}/>)}{h.trustpilot&&<TrustpilotStrip badge={h.trustpilot}/>}</main>;
}
