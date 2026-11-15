import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { useTranslation } from '../store/preferences';
import { flagEmoji } from '../lib/localeOptions';
export type LocaleOption = { value: string; label: string; search?: string; flag?: string; globe?: boolean };
export function LocaleOptionIcon({ option }: { option?: LocaleOption }) {
  return option?.flag ? <span className="locale-flag" aria-hidden="true">{flagEmoji(option.flag)}</span> : option?.globe ? <Globe2 className="locale-option-globe" size={17} aria-hidden="true"/> : null;
}
export default function LocaleSelect({ label, value, options, onChange, disabled }: { label:string; value:string; options:LocaleOption[]; onChange:(value:string)=>void; disabled?:boolean }) {
  const t = useTranslation();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const [active,setActive] = useState(0);
  const [upwards,setUpwards] = useState(false);
  const matches = options.filter(option => `${option.label} ${option.search ?? ''} ${option.value}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = options.find(option => option.value === value);
  function show() {
    const rect = root.current?.getBoundingClientRect();
    const boundary = root.current?.closest('dialog')?.getBoundingClientRect();
    setUpwards(!!rect && !!boundary && boundary.bottom - rect.bottom < 195);
    setQuery(''); setActive(0); setOpen(true);
  }
  function select(option:LocaleOption) { onChange(option.value); setOpen(false); trigger.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = (event:PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown',outside);
    return () => document.removeEventListener('pointerdown',outside);
  },[open]);
  useEffect(() => { list.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block:'nearest' }); },[active,query]);
  return <div ref={root} className={`settings-field ${open ? 'is-open' : ''} ${upwards ? 'opens-upwards' : ''}`} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <label id={`${id}-label`} htmlFor={`${id}-control`}>{label}</label>
    <div className="settings-select-control">
      {open ? <input ref={input} id={`${id}-control`} role="combobox" aria-labelledby={`${id}-label`} aria-expanded="true" aria-controls={`${id}-options`} aria-autocomplete="list" aria-activedescendant={matches[active] ? `${id}-option-${active}` : undefined} value={query} placeholder={t('Search…')} autoComplete="off" onChange={event => {setQuery(event.target.value);setActive(0);}} onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(0,Math.min(matches.length-1,index+(event.key==='ArrowDown'?1:-1)))); }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault();setActive(event.key === 'Home'?0:Math.max(0,matches.length-1)); }
        if (event.key === 'Enter') {event.preventDefault();if(matches[active])select(matches[active]);}
        if (event.key === 'Escape') {event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
      }}/> : <button ref={trigger} type="button" id={`${id}-control`} role="combobox" aria-labelledby={`${id}-label`} aria-expanded="false" aria-controls={`${id}-options`} aria-haspopup="listbox" disabled={disabled} onClick={show} onKeyDown={event => {if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show();}}}><LocaleOptionIcon option={selected}/><span>{selected?.label ?? value}</span></button>}
      <ChevronDown size={18} strokeWidth={3} aria-hidden="true"/>
    </div>
    {open && <ul ref={list} id={`${id}-options`} className="settings-options" role="listbox" aria-labelledby={`${id}-label`}>
      {matches.map((option,index) => <li role="option" id={`${id}-option-${index}`} data-option-index={index} key={option.value} aria-selected={option.value===value} className={index===active?'active':''} onMouseDown={event=>event.preventDefault()} onMouseMove={()=>setActive(index)} onClick={()=>select(option)}><LocaleOptionIcon option={option}/><span>{option.label}</span></li>)}
      {!matches.length && <li className="settings-no-options" role="presentation">{t('No matching options')}</li>}
    </ul>}
  </div>;
}
