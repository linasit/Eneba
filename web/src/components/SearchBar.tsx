import { useTranslation } from "../store/preferences";
import { usePreferences } from "../store/preferences";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchBar() {
  const t = useTranslation();
  const language = usePreferences(s => s.language);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const q = useDebounced(text.trim());
  const { data = [] } = useQuery({
    queryKey: ["suggest", q],
    enabled: q.length >= 2,
    queryFn: () =>
      api<{ slug: string; name: string; cover_url: string }[]>(
        `/search/suggest?q=${encodeURIComponent(q)}`,
      ),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);
    nav(`/store?q=${encodeURIComponent(text.trim())}&sort=relevance`);
  };

  return (
    <form onSubmit={submit} className="search" role="search">
      <input
        className="input"
        value={text}
        placeholder={language === "lt" ? t("Ieškoti žaidimų, papildymų ir daugiau") : t("Search for games, keys and more")}
        aria-label={t("Search")}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => setOpen(true)}
      />
      <button className="search-submit" aria-label={t("Submit search")}>
        <Search size={21} />
      </button>
      {open && data.length > 0 && q.length >= 2 && (
        <ul
          style={{
            position: "absolute",
            top: "110%",
            left: 0,
            right: 0,
            background: "var(--purple-800)",
            color: "#fff",
            borderRadius: 0,
            listStyle: "none",
            margin: 0,
            padding: 8,
            zIndex: 20,
            boxShadow: "var(--shadow)",
          }}
        >
          {data.map((s) => (
            <li key={s.slug}>
              <a
                href={`/p/${s.slug}`}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 8,
                }}
              >
                <img
                  src={s.cover_url}
                  alt=""
                  width={36}
                  height={48}
                  style={{ borderRadius: 6, objectFit: "cover" }}
                />
                {t(s.name)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
