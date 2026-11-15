import { useTranslation } from "../store/preferences";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
export default function ProductGallery({ trailerOnly = false }: { trailerOnly?: boolean }) {
  const t = useTranslation();
  const [selected, setSelected] = useState(1);
  const strip = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previous = () => setSelected(n => n === 1 ? 5 : n-1);
  const next = () => setSelected(n => n === 5 ? 1 : n+1);
  return <>
    <div className={`product-gallery ${trailerOnly ? "trailer-only-gallery" : ""}`}><button className="gallery-scroll gallery-scroll-previous" title={t("Previous screenshot")} aria-label={t("Previous screenshot")} onClick={()=>strip.current?.scrollBy({left:-350,behavior:"smooth"})}><ChevronLeft size={22}/></button><div ref={strip} className="product-media-strip" tabIndex={0} aria-label={t("Product screenshots and trailer")}>
      <a className="product-media-thumbnail" href="https://www.youtube.com/watch?v=QdBZY2fkU-0" target="_blank" rel="noopener noreferrer" title={t("Watch Grand Theft Auto VI trailer")} aria-label={t("Watch Grand Theft Auto VI trailer")}><img src="/reference/gta-vi/media-0.jpg" alt={t("Grand Theft Auto VI trailer")} loading="lazy"/><span className="trailer-play"><Play size={15} fill="currentColor"/></span></a>
      {!trailerOnly && [1,2,3,4,5].map(n=><button key={n} className="product-media-thumbnail" aria-label={t("View product screenshot {0}", {0: n})} onClick={()=>{setSelected(n);dialog.current?.showModal();}}><img src={`/reference/gta-vi/media-${n}.jpg`} alt={t("Grand Theft Auto VI screenshot {0}", {0: n})} loading="lazy"/></button>)}
    </div><button className="gallery-scroll gallery-scroll-next" title={t("Next screenshot")} aria-label={t("Next screenshot")} onClick={()=>strip.current?.scrollBy({left:350,behavior:"smooth"})}><ChevronRight size={22}/></button></div>
    <dialog className="product-media-dialog" ref={dialog} aria-label={t("Product screenshot viewer")} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();previous();}if(e.key==='ArrowRight'){e.preventDefault();next();}}}>
      <button className="media-close" title={t("Close screenshot viewer")} aria-label={t("Close screenshot viewer")} onClick={()=>dialog.current?.close()}><X size={27}/></button>
      <img src={`/reference/gta-vi/media-${selected}.jpg`} alt={t("Grand Theft Auto VI screenshot {0}", {0: selected})}/>
      <div className="media-viewer-controls"><button title={t("Previous screenshot")} aria-label={t("Previous screenshot")} onClick={previous}><ChevronLeft/></button><span>{selected} / 5</span><button title={t("Next screenshot")} aria-label={t("Next screenshot")} onClick={next}><ChevronRight/></button></div>
    </dialog>
  </>;
}
