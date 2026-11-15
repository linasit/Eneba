import { useTranslation, useItemCount } from "../store/preferences";
import { useEffect, useId, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../store/cart";
import { useCartConfirmation } from "../store/cartConfirmation";

export default function AddedToCartModal() {
  const t = useTranslation();
  const itemCount = useItemCount();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const open = useCartConfirmation(s => s.open);
  const close = useCartConfirmation(s => s.close);
  const count = useCart(s => s.lines.reduce((total, line) => total + line.qty, 0));
  const location = useLocation();
  useEffect(() => { close(); }, [location.key, close]);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) {
        // A card's cart button hides on mouseleave; return to its visible product link.
        const returnFocus = trigger.closest(".has-hover-actions")?.querySelector<HTMLElement>(".product-title") ?? trigger;
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);
  return <dialog ref={dialog} className="added-to-cart-modal" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <svg className="added-to-cart-icon" viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <path d="M7 9h7c7 0 10 3 12 11l17 64c1 5 4 8 10 8h52c5 0 8-3 9-8l10-39" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="m64 48 12 12c3 3 5 3 8-1l20-28" stroke="#00c9a4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="59" cy="117" r="10" stroke="white" strokeWidth="7"/>
      <circle cx="101" cy="117" r="10" stroke="white" strokeWidth="7"/>
    </svg>
    <h2 id={titleId}>{t("Added to cart")}</h2>
    <p id={descriptionId}>{t("You have ")}<strong>{itemCount(count)}</strong> {t(" in your cart")}</p>
    <div className="added-to-cart-actions">
      <button type="button" onClick={close}>{t("Continue shopping")}</button>
      <Link to="/checkout" onClick={close}>{t("View cart")}</Link>
    </div>
  </dialog>;
}
