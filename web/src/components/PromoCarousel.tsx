import { useTranslation, usePreferences } from "../store/preferences";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
interface Banner {
  id: number;
  title: string;
  title_lt?:string;
  image_url: string;
  thumbnail_url?: string;
  cta_url: string;
  cta_label: string;
}
export default function PromoCarousel({endpoint}:{endpoint:string}) {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);
  const bannerTitle = (b:Banner,_i:number) => language === "lt" ? b.title_lt ?? b.title : b.title;
  const { data = [], isLoading } = useQuery({
    queryKey: ["home", "banners"],
    queryFn: () => api<Banner[]>(endpoint),
  });
  const [active, setActive] = useState(0),
    [hovered, setHovered] = useState(false),
    [expanded, setExpanded] = useState(false);
  const touch = useRef<number | null>(null);
  const current = active % Math.max(data.length, 1);
  useEffect(() => {
    if (
      hovered ||
      data.length < 2 ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = setInterval(() => setActive((x) => (x + 1) % data.length), 6500);
    return () => clearInterval(id);
  }, [hovered, data.length]);
  if (isLoading) return <div className="campaign-skeleton skeleton" />;
  if (!data.length) return null;
  const select = (n: number) => {
    setExpanded(true);
    setActive(n);
  };
  const step = (n: number) => {
    setExpanded(true);
    setActive((x) => (x + n + data.length) % data.length);
  };
  return (
    <section
      className={`campaign-carousel ${expanded ? "is-expanded" : ""}`}
      aria-roledescription="carousel"
      aria-label={t("Featured promotions")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touch.current !== null) {
          const delta = e.changedTouches[0].clientX - touch.current;
          if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
          touch.current = null;
        }
      }}
    >
      <div className="campaign-panels">
        {data.map((b, i) => (
          <div
            key={b.id}
            className={`campaign-panel ${i === current ? "active" : ""}`}
            style={{
              backgroundImage: `url("${i === current ? b.image_url : b.thumbnail_url || b.image_url}")`,
            }}
          >
            {i === current ? (
              <Link
                className="campaign-link"
                to={b.cta_url}
                aria-label={bannerTitle(b,i)}
              >
                <span className="sr-only">
                  {bannerTitle(b,i)} — {t(b.cta_label)}
                </span>
              </Link>
            ) : (
              <button
                className="campaign-select"
                onClick={() => select(i)}
                aria-label={t("Show promotion: {0}", {0: bannerTitle(b,i)})}
              >
                <span className="sr-only">{bannerTitle(b,i)}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
