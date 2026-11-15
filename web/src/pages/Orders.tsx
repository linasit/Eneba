import { useMoney } from "../lib/useMoney";
import { useTranslation, usePreferences } from "../store/preferences";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PackageCheck, ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
interface Order {
  id: number;
  total_cents: number;
  created_at: string;
  status: string;
}
export default function Orders() {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);
  const eur = useMoney();
  const q = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>("/orders"),
  });
  return (
    <main className="container page">
      <span className="eyebrow">{t("YOUR PERSONAL VAULT")}</span>
      <h1>{t("My orders")}</h1>
      <p className="muted">
        {t("All your adventures, in one place. Your keys are always here.")}</p>
      {q.isLoading ? (
        <p>{t("Loading your orders…")}</p>
      ) : q.isError ? (
        <p role="alert">{t("Unable to load orders. Please refresh.")}</p>
      ) : q.data?.length ? (
        q.data.map((o) => (
          <Link className="card order-row" key={o.id} to={`/orders/${o.id}`}>
            <PackageCheck />
            <div>
              <b>{t("Order #")}{o.id}</b>
              <p className="muted">
                {new Date(o.created_at).toLocaleDateString(language === "lt" ? "lt-LT" : "en-IE")} · {t(o.status)}
              </p>
            </div>
            <strong>{eur(o.total_cents)}</strong>
            <span>
              {t("View keys")}<ArrowUpRight size={16} />
            </span>
          </Link>
        ))
      ) : (
        <div className="empty-state">
          <PackageCheck size={48} />
          <h2>{t("Your vault is waiting")}</h2>
          <p>{t("Your purchased game keys will appear here.")}</p>
          <Link className="btn btn-primary" to="/store">
            {t("Find your next game")}</Link>
        </div>
      )}
    </main>
  );
}
