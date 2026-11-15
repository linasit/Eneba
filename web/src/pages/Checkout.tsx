import { useMoney } from "../lib/useMoney";
import { useTranslation } from "../store/preferences";
import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useCart } from "../store/cart";

export default function Checkout() {
  const t = useTranslation();
  const eur = useMoney();
  const { lines, total, setQty, remove, clear } = useCart();
  const [paymentParams, setPaymentParams] = useSearchParams();
  const paypal = paymentParams.get("method") === "paypal";
  const [card, setCard] = useState("4242 4242 4242 4242");
  const attempt = useRef({ cart: "", key: "" });
  const cartSignature = JSON.stringify([paypal, lines.map((l) => [l.offerId, l.qty])]);
  const nav = useNavigate();
  const qc = useQueryClient();

  const pay = useMutation({
    mutationFn: () => {
      if (attempt.current.cart !== cartSignature)
        attempt.current = { cart: cartSignature, key: crypto.randomUUID() };
      return api<{ orderId: number }>("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": attempt.current.key },
        body: JSON.stringify({
          card: paypal ? "4242 4242 4242 4242" : card,
          items: lines.map((l) => ({ offerId: l.offerId, qty: l.qty })),
        }),
      });
    },
    onSuccess: ({ orderId }) => {
      void qc.invalidateQueries({ queryKey: ["offers"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      clear();
      nav(`/orders/${orderId}`);
    },
  });

  if (lines.length === 0)
    return (
      <div className="container">
        <h1>{t("Your cart is empty")}</h1>
      </div>
    );
  return (
    <div className="container checkout-layout">
      <section>
        <h1>{t("Cart")}</h1>
        {lines.map((l) => (
          <div
            key={l.offerId}
            className="card"
            style={{
              display: "flex",
              gap: 16,
              padding: 12,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <img
              src={l.cover}
              alt=""
              width={60}
              height={80}
              style={{ borderRadius: 8, objectFit: "cover" }}
            />
            <div style={{ flex: 1 }}>
              <b>{t(l.name)}</b>
              <div style={{ color: "var(--text-muted)" }}>
                {t("Seller:")}{l.seller}
              </div>
            </div>
            <input
              className="input"
              type="number"
              min={1}
              max={5}
              aria-label={t("Quantity for {0}", {0:t(l.name)})}
              value={l.qty}
              style={{ width: 70 }}
              onChange={(e) => setQty(l.offerId, +e.target.value)}
            />
            <div className="price">{eur(l.unitCents * l.qty)}</div>
            <button
              className="btn btn-ghost"
              onClick={() => remove(l.offerId)}
              aria-label={t("Remove")}
            >
              ✕
            </button>
          </div>
        ))}
      </section>
      <aside className="card" style={{ padding: 20, alignSelf: "start" }}>
        <h2 style={{ marginTop: 0 }}>{t("Payment")}</h2><p>{t("Converted prices are estimates. Checkout is charged in EUR.")}</p>
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
          {t("🧪 Test mode. Use")} <code>4242 4242 4242 4242</code> {t(" (success) or")}{" "}
          <code>4000 0000 0000 0002</code> {t("(decline). No real charge is made.")}</p>
        <div className="demo-payment-options" role="group" aria-label={t("Demo payment method")}>
          <button className={`btn ${!paypal ? 'btn-primary':'btn-ghost'}`} aria-pressed={!paypal} onClick={()=>setPaymentParams({})}>{t("Test card")}</button>
          <button className={`btn ${paypal ? 'btn-primary':'btn-ghost'}`} aria-pressed={paypal} onClick={()=>setPaymentParams({method:'paypal'})}>{t("PayPal demo")}</button>
        </div>
        {paypal ? <div className="demo-paypal-message"><img src="/reference/footer/braintree_paypal.svg" alt={t("PayPal")}/><p>{t("Simulated PayPal checkout. No PayPal login, account connection, or real payment is required.")}</p></div> : <input className="input" value={card} onChange={e=>setCard(e.target.value)} inputMode="numeric" aria-label={t("Card number")}/>}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            margin: "20px 0",
          }}
        >
          <span>{t("Total")}</span>
          <span className="price">{eur(total())}</span>
        </div>
        {pay.isError && (
          <p role="alert" style={{ color: "var(--danger)" }}>
            {t((pay.error as Error).message)}
          </p>
        )}
        <button
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={pay.isPending}
          onClick={() => pay.mutate()}
        >
          {pay.isPending ? t("Processing…") : paypal ? t("Complete demo PayPal payment") : t("Pay now")}
        </button>
      </aside>
    </div>
  );
}
