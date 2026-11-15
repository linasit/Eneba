import { useTranslation } from "../store/preferences";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
export default function OfferInfo({ label, children }: { label: string; children: ReactNode }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown',close); document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};
  }, [open]);
  return <span className="offer-info" ref={root} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);}}><button type="button" className="offer-info-button" aria-label={t(label)} aria-expanded={open} aria-controls={id} aria-describedby={open ? id : undefined} onClick={()=>setOpen(true)}><Info size={16}/></button>{open && <span className="offer-info-popover" id={id} role="tooltip">{children}</span>}</span>;
}
