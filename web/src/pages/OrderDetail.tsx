import { useMoney } from "../lib/useMoney";
import { useTranslation } from "../store/preferences";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";

interface Line {
  name: string;
  cover_url: string;
  unit_cents: number;
  key_value: string;
}

export default function OrderDetail() {
  const t = useTranslation();
  const eur = useMoney();
  const { id } = useParams();
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["orders", id],
    queryFn: () => api<Line[]>(`/orders/${id}`),
  });
  const [copied, setCopied] = useState("");
  if (isLoading)
    return <main className="container page">{t("Loading your keys…")}</main>;
  if (isError)
    return (
      <main className="container page">
        <h1>{t("Order unavailable")}</h1>
        <p role="alert">
          {t("This order could not be loaded. Check your order history or try again.")}</p>
      </main>
    );
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1>{t("🎉 Order #")}{id} {t(" complete")}</h1>
      <p style={{ color: "var(--text-muted)" }}>
        {t("Your keys are below and always available in your order history.")}</p>
      {copied === "failed" && (
        <p role="alert">{t("Could not copy. Select and copy the key manually.")}</p>
      )}
      {data.map((l, i) => (
        <div
          key={i}
          className="card"
          style={{
            display: "flex",
            gap: 16,
            padding: 16,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <img
            src={l.cover_url}
            alt=""
            width={60}
            height={80}
            style={{ borderRadius: 8, objectFit: "cover" }}
          />
          <div style={{ flex: 1 }}>
            <b>{t(l.name)}</b> · {eur(l.unit_cents)}
            <div>
              <code style={{ fontSize: "var(--fs-lg)", color: "var(--lime)" }}>
                {l.key_value}
              </code>
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => {
              void navigator.clipboard
                .writeText(l.key_value)
                .then(() => setCopied(l.key_value))
                .catch(() => setCopied("failed"));
            }}
          >
            {copied === l.key_value ? t("Copied ✓") : t("Copy key")}
          </button>
        </div>
      ))}
    </div>
  );
}
