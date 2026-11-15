import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCart } from '../store/cart';
import { useTranslation } from '../store/preferences';
import { useMoney } from '../lib/useMoney';
export default function CartPanel({open,onClose}:{open:boolean;onClose:()=>void}) {
 const t=useTranslation(),money=useMoney();
 const {lines,setQty,remove,total}=useCart();
 const dialog=useRef<HTMLDialogElement>(null),location=useLocation();
 useEffect(()=>{onClose();},[location.key]);
 useEffect(()=>{if(!open)return;const element=dialog.current!;const trigger=document.activeElement as HTMLElement;const previous=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{element.close();document.body.style.overflow=previous;trigger?.focus({preventScroll:true});};},[open]);
 return <dialog ref={dialog} id="shopping-cart-dialog" className="shopping-cart-panel" aria-labelledby="shopping-cart-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}}>
  <header><h2 id="shopping-cart-title">{t('My shopping cart')}</h2><button onClick={onClose} aria-label={t('Close cart')}><X size={24}/></button></header>
  <div className="shopping-cart-items">{lines.length?lines.map(line=><article key={line.offerId} className="shopping-cart-item"><Link to={`/p/${line.productSlug}`} onClick={onClose} tabIndex={-1} aria-hidden="true"><img src={line.cover} alt=""/></Link><div><div className="shopping-cart-seller"><span>{line.seller.slice(0,1)}</span><b>{line.seller}</b><button aria-label={t('Remove {0} from cart',{0:t(line.name)})} onClick={()=>remove(line.offerId)}><Trash2 size={19}/></button></div><Link className="shopping-cart-product" to={`/p/${line.productSlug}`} onClick={onClose}>{t(line.name)}</Link><p>{t('Digital product')}</p><div className="shopping-cart-quantity"><div><button disabled={line.qty<=1} aria-label={t('Decrease quantity for {0}',{0:t(line.name)})} onClick={()=>setQty(line.offerId,line.qty-1)}><Minus size={14}/></button><span>{line.qty}</span><button disabled={line.qty>=5} aria-label={t('Increase quantity for {0}',{0:t(line.name)})} onClick={()=>setQty(line.offerId,line.qty+1)}><Plus size={15}/></button></div><strong>{money(line.unitCents*line.qty)}</strong></div></div></article>):<div className="shopping-cart-empty"><ShoppingCart size={44}/><h3>{t('Your cart is empty')}</h3><p>{t('Add products to start shopping.')}</p></div>}</div>
  <footer><div className="shopping-cart-service"><span>{t("Service fee:")}</span><span title={t("No service fee is charged in this demo.")}>—</span></div><div className="shopping-cart-total"><b>{t('Total')}</b><strong>{money(total())}</strong></div><p className="shopping-cart-demo">{t('Simulated checkout · No real charge')}</p>{lines.length?<><Link className="shopping-cart-view" to="/checkout" onClick={onClose}>{t('View cart')}</Link><Link className="shopping-cart-checkout" to="/checkout" onClick={onClose}>{t('Checkout now')}</Link></>:<Link className="shopping-cart-view" to="/store" onClick={onClose}>{t('Continue shopping')}</Link>}</footer>
 </dialog>;
}
