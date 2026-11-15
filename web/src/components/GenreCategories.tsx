import { useTranslation } from "../store/preferences";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Genre = { label: string; icon: string; count: number };

export default function GenreCategories({endpoint,title}:{endpoint:string;title:string}) {
  const t = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["home", "genres"],
    queryFn: () => api<Genre[]>(endpoint),
  });
  return (
    <section className="genre-section" aria-labelledby="genre-heading">
      <h2 id="genre-heading">{title}</h2>
      {isError ? (
        <button className="btn btn-ghost" onClick={() => refetch()}>{t("Retry loading categories")}</button>
      ) : (
        <>
          <div className="genre-grid" id="genre-categories" aria-busy={isPending}>
            {isPending ? Array.from({ length: 7 }, (_, i) => <div className="genre-tile skeleton" key={i} />) :
              data.slice(0, expanded ? data.length : 7).map((genre) => (
                <Link className="genre-tile" key={genre.icon}
                  to={`/store?genre=${encodeURIComponent(genre.label)}`} aria-label={t("{0} ({1} products)", {0: t(genre.label), 1: genre.count})}>
                  <span className="genre-count">{genre.count}</span>
                  <img src={`/reference/genres/${genre.icon}.svg`} width="40" height="40" alt="" loading="lazy" />
                  <span>{t(genre.label)}</span>
                </Link>
              ))}
          </div>
          {!isPending && !expanded && data.length > 7 && (
            <button className="btn btn-ghost genre-load-more" aria-expanded={expanded}
              aria-controls="genre-categories" onClick={() => setExpanded(true)}>{t("Load more")}</button>
          )}
        </>
      )}
    </section>
  );
}
