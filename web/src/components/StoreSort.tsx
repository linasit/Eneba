import { useTranslation } from "../store/preferences";
import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, Check, ChevronDown } from "lucide-react";
const options = [
  ["price_asc", "Price: Low to High"], ["price_desc", "Price: High to Low"],
  ["newest", "Date: Newest First"], ["oldest", "Date: Oldest First"],
  ["popular", "Popularity: Most popular"], ["name_asc", "Alphabet: A-Z"], ["name_desc", "Alphabet: Z-A"],
];
export default function StoreSort({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const label = options.find(([key]) => key === value)?.[1] ?? (value === "discount" ? "Biggest discount" : "Best match");
  useEffect(() => {
    if (!open) return;
    items.current[Math.max(0, options.findIndex(([key]) => key === value))]?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, value]);
  return <div ref={root} className={`store-sort-dropdown ${open ? "is-open" : ""}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} className="store-sort-trigger" aria-label={t("Sort products: {0}", {0: t(label)})} aria-expanded={open} aria-haspopup="menu" aria-controls="store-sort-options" onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
      <ArrowDownWideNarrow size={23} /><span>{t(label)}</span><ChevronDown size={20} />
    </button>
    {open && <div className="store-sort-options" id="store-sort-options" role="menu" aria-label={t("Sort products")}>
      {options.map(([key, name], index) => <button key={key} ref={element => { items.current[index] = element; }} role="menuitemradio" aria-checked={value === key} tabIndex={-1} onClick={() => { onChange(key); setOpen(false); trigger.current?.focus(); }} onKeyDown={event => {
        const next = event.key === "ArrowDown" ? (index + 1) % options.length : event.key === "ArrowUp" ? (index + options.length - 1) % options.length : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
        if (next >= 0) { event.preventDefault(); items.current[next]?.focus(); }
      }}><span>{t(name)}</span>{value === key && <Check size={23} strokeWidth={4} aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
