import { useTranslation } from "../store/preferences";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Brand from "./Brand";

type Entry = { label: string; slug: string; children?: [string, string][]; fresh?: boolean };
const entries: Entry[] = [
  { label: "All offers", slug: "" },
  { label: "Mobile games", slug: "mobile-games", fresh: true, children: [["All mobile games", "mobile-games"], ["Mobile game top-ups", "top-up-games"]] },
  { label: "Games", slug: "games", children: [["All games", "games"], ["PC games", "steam"], ["Steam games", "steam"], ["Pre-orders", "pre-orders"]] },
  { label: "Gaming eCards", slug: "gaming-ecards", children: [["All gaming eCards", "gaming-ecards"], ["Steam Gift Cards", "steam-gift-cards"], ["PlayStation cards", "psn"], ["Xbox cards", "xbox"]] },
  { label: "eGift Cards", slug: "egift-cards", children: [["All eGift Cards", "egift-cards"], ["Amazon", "amazon"]] },
  { label: "E-money cards", slug: "e-money", children: [["All E-money cards", "e-money"]] },
  { label: "Xbox", slug: "xbox", children: [["All Xbox offers", "xbox"], ["Xbox games", "xbox"], ["Xbox subscriptions", "xbox-game-pass"]] },
  { label: "PSN", slug: "psn", children: [["All PlayStation offers", "psn"], ["PlayStation games", "psn"], ["PlayStation Gift Cards", "psn"]] },
  { label: "Nintendo", slug: "nintendo", children: [["All Nintendo offers", "nintendo"], ["Nintendo games", "nintendo"]] },
  { label: "Software", slug: "software", children: [["All software", "software"], ["Antivirus", "antivirus"]] },
  { label: "Mobile recharges", slug: "mobile-recharges" },
  { label: "eSIM", slug: "esim", children: [["All eSIM offers", "esim"]] },
  { label: "Gift Guide", slug: "gift-guide" },
];
const destination = (slug: string) => slug ? `/store?category=${encodeURIComponent(slug)}` : "/store";
export default function CategoryMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Entry | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) { setActive(null); element.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { element.close(); document.body.style.overflow = previous; }; }
    element.close();
  }, [open]);
  useEffect(() => { if (active) back.current?.focus(); }, [active]);
  return <dialog ref={dialog} id="header-categories" className="categories-drawer" aria-label={t("Categories")} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX > rect.right || event.clientX < rect.left) onClose(); } }}>
    <div className="categories-drawer-heading"><span onClick={onClose}><Brand /></span><button autoFocus onClick={onClose} aria-label={t("Close categories")}><X size={28} strokeWidth={1.3} /></button></div>
    <nav className="categories-drawer-list" aria-label={active ? t("{0} categories", {0: t(active.label)}) : t("Browse categories")}>
      {active ? <><button ref={back} className="categories-back" onClick={() => setActive(null)}><ChevronLeft size={22} /> {t(" All categories")}</button><h2>{t(active.label)}</h2>{active.children?.map(([label, slug]) => <Link key={label} to={destination(slug)} onClick={onClose}>{t(label)}</Link>)}</> : entries.map(entry => entry.children ? <button key={entry.label} className={entry.fresh ? "category-new" : ""} onClick={() => setActive(entry)} aria-haspopup="true"><span>{t(entry.label)}</span>{entry.fresh && <span className="category-new-badge">{t("NEW")}</span>}<ChevronRight size={24} strokeWidth={1.5} /></button> : <Link key={entry.label} to={destination(entry.slug)} onClick={onClose}>{t(entry.label)}</Link>)}
    </nav>
  </dialog>;
}
