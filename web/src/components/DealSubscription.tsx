import { useTranslation } from "../store/preferences";
import { useRef, useState } from "react";
import { X } from "lucide-react";
export default function DealSubscription() {
  const t = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email,setEmail] = useState('');
  const [saved,setSaved] = useState(false);
  const [error,setError] = useState('');
  return <><div className="reference-deals-panel"><svg className="deals-percent-icon" width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="2" strokeDasharray="3 3"/><path d="M10 22 22 10"/><circle cx="11" cy="11" r="2.5"/><circle cx="21" cy="21" r="2.5"/></svg><div><h3>{t("Looking for good deals?")}</h3><p>{t("Save your interest in future deals.")}</p><button className="reference-offer-buy primary" onClick={()=>{setSaved(false);setError('');dialog.current?.showModal();}}>{t("Subscribe")}</button></div></div>
    <dialog className="locale-dialog deal-subscription-dialog" ref={dialog} aria-labelledby="deal-subscription-title"><button className="locale-dialog-close" aria-label={t("Close subscription dialog")} onClick={()=>dialog.current?.close()}><X size={26}/></button><h2 id="deal-subscription-title">{t("Deal updates")}</h2>{saved ? <div role="status"><p>{t("Your demo subscription preference is saved on this device. No emails are sent.")}</p><button className="reference-offer-buy primary" onClick={()=>dialog.current?.close()}>{t("Done")}</button></div> : <form onSubmit={event=>{event.preventDefault();try{localStorage.setItem('eneba-demo-deal-preference',JSON.stringify({email,subscribedAt:new Date().toISOString()}));setSaved(true);}catch{setError('Unable to save your preference. Please try again.');}}}><p>{t("This demo saves your preference on this device. It does not send emails or sign you up with Eneba.")}</p><label>{t("Email address")}<input type="email" required maxLength={254} autoComplete="email" className="input" value={email} onChange={e=>setEmail(e.target.value)}/></label>{error&&<p role="alert">{t(error)}</p>}<button className="reference-offer-buy primary" type="submit">{t("Subscribe")}</button></form>}</dialog>
  </>;
}
