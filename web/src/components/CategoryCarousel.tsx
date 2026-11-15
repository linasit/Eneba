import { useTranslation, usePreferences } from "../store/preferences";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
export interface Category {
  slug: string;
  label: string;
  label_lt?:string;
  icon_url: string;
}
export default function CategoryCarousel({endpoint,title}:{endpoint:string;title:string}) {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);

  const { data = [] } = useQuery({
    queryKey: ["home", "categories"],
    queryFn: () => api<Category[]>(endpoint),
  });
  const rail = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () =>
      setEnds({
        start: el.scrollLeft < 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [data.length]);
  const move = (dir: number) => {
    const el = rail.current;
    if (el)
      el.scrollBy({
        left: dir * Math.max(200, el.clientWidth * 0.75),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <nav className="category-carousel" aria-label={title}>
      <button
        className="category-arrow previous"
        aria-label={t("Show previous categories")}
        disabled={ends.start}
        onClick={() => move(-1)}
      >
        <ChevronLeft />
      </button>
      <div className="category-track" ref={rail}>
        {data.map((c) => (
          <Link key={c.slug} to={`/store?category=${c.slug}`}>
            <img src={c.icon_url} alt="" />
            <span>{language === "lt" ? c.label_lt ?? t(c.label) : t(c.label)}</span>
          </Link>
        ))}
      </div>
      <button
        className="category-arrow next"
        aria-label={t("Show more categories")}
        disabled={ends.end}
        onClick={() => move(1)}
      >
        <ChevronRight />
      </button>
    </nav>
  );
}
