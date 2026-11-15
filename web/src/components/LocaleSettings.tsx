import { useEffect, useRef, useState } from 'react';
import { X, Globe2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { type Preferences, usePreferences, useTranslation } from '../store/preferences';
import { countryCodes, countryName, currencyCodes, currencyLabel, languageOptions, localeFor, regionalOptions, type Currency, type Language } from '../lib/localeOptions';
import LocaleSelect, { LocaleOptionIcon, type LocaleOption } from './LocaleSelect';

export default function LocaleSettings({footer=false}:{footer?:boolean}) {
  const saved=usePreferences();
  const t=useTranslation();
  const queryClient=useQueryClient();
  const [draft,setDraft]=useState<Preferences>({region:saved.region,language:saved.language,currency:saved.currency});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const regions:LocaleOption[]=[...regionalOptions.map(option=>({...option,label:t(option.label),globe:!('flag' in option)})),...countryCodes.map(code=>({value:code,label:countryName(code,saved.language),search:countryName(code,'en'),flag:code})).sort((a,b)=>a.label.localeCompare(b.label,localeFor(saved.language)))];
  const currencies=currencyCodes.map(code=>({value:code,label:currencyLabel(code,saved.language),search:`${code} ${currencyLabel(code,'en')}`}));
  const languages=languageOptions.map(option=>({...option}));
  const close=()=>{setOpen(false);};
  useEffect(()=>{document.documentElement.lang=saved.language;document.title=t('Eneba — Your next adventure starts here');},[saved.language]);
  useEffect(()=>{
    if(!open)return;
    const element=dialog.current;if(!element)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();
    return()=>{element.close();document.body.style.overflow=previous;trigger.current?.focus();};
  },[open]);
  async function save(){
    setBusy(true);setError('');
    try{
      if(draft.currency!=='EUR'){
        const response=await fetch(`https://api.frankfurter.dev/v2/rate/eur/${draft.currency.toLowerCase()}`,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error();const rate=await response.json();if(!(rate.rate>0))throw new Error();
        queryClient.setQueryData(['exchange-rate',draft.currency],rate);
        try{sessionStorage.setItem(`eneba-rate-${draft.currency}`,JSON.stringify(rate));}catch{/* Query cache still applies the validated rate. */}
      }
      saved.save(draft);close();
    }catch{setError('Could not load the exchange rate. Please try again.');}
    finally{setBusy(false);}
  }
  return <>
    <button ref={trigger} className={footer?'footer-settings-trigger':'locale locale-trigger'} aria-haspopup="dialog" aria-label={t('Region, language and currency settings')} onClick={()=>{setDraft({region:saved.region,language:saved.language,currency:saved.currency});setError('');setOpen(true);}}>
      {footer?<LocaleOptionIcon option={regions.find(option=>option.value===saved.region)}/>:<Globe2 size={17} aria-hidden="true"/>}<span>{languageOptions.find(option=>option.value===saved.language)?.label} | {saved.currency}</span>
    </button>
    <dialog ref={dialog} className="locale-dialog settings-dialog" aria-labelledby={footer?'footer-settings-title':'header-settings-title'} onCancel={event=>{event.preventDefault();if(!busy)close();}} onClick={event=>{if(event.target!==event.currentTarget||busy)return;const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();}}>
      <button className="locale-dialog-close" type="button" onClick={close} disabled={busy} aria-label={t('Close settings')}><X size={22}/></button>
      <form onSubmit={event=>{event.preventDefault();void save();}}>
        <h2 id={footer?'footer-settings-title':'header-settings-title'}>{t('Update your settings')}</h2>
        <p>{t('Set your preferred region, language, and the currency.')}</p>
        {open&&<div className="settings-fields">
          <LocaleSelect label={t('Region')} value={draft.region} options={regions} onChange={value=>setDraft({...draft,region:value})} disabled={busy}/>
          <LocaleSelect label={t('Language')} value={draft.language} options={languages} onChange={value=>setDraft({...draft,language:value as Language})} disabled={busy}/>
          <LocaleSelect label={t('Currency')} value={draft.currency} options={currencies} onChange={value=>setDraft({...draft,currency:value as Currency})} disabled={busy}/>
        </div>}
        {draft.language!=='lt'&&!draft.language.startsWith('en')&&<small>{t('English is used where translations are unavailable.')}</small>}
        {draft.currency!=='EUR'&&<small>{t('Converted prices are estimates. Checkout is charged in EUR.')}</small>}
        {error&&<p className="locale-error" role="alert">{t(error)}</p>}
        <div className="locale-dialog-actions"><button type="button" className="locale-cancel" onClick={close} disabled={busy}>{t('Cancel')}</button><button type="submit" className="locale-save" disabled={busy}>{t(busy?'Saving…':'Save')}</button></div>
      </form>
    </dialog>
  </>;
}
