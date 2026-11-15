import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from '../store/preferences';

export default function SupportSort({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const t=useTranslation();
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false);
  const options=[{value:'newest',label:t('Newest')},{value:'oldest',label:t('Oldest request')}];
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  function select(next:string){onChange(next);setOpen(false);trigger.current?.focus();}
  return <div className="account-support-sort"><div ref={root} className="support-sort-control" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{
    if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();
      if(!open){setOpen(true);return;}
      const buttons=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')??[]);
      const current=buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next=event.key==='Home'?0:event.key==='End'?1:(current+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;
      buttons[next]?.focus();
    }
  }}><span id={`${id}-label`} className="support-sort-label">{t('Sort by')}</span><button ref={trigger} className="support-sort-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="menu" aria-expanded={open} aria-controls={open?`${id}-menu`:undefined} onClick={()=>setOpen(!open)}><span id={`${id}-value`}>{options.find(option=>option.value===value)?.label}</span><ChevronDown size={24} strokeWidth={3}/></button>{open&&<div className="support-sort-menu" role="menu" id={`${id}-menu`} aria-labelledby={`${id}-label`}>{options.map(option=><button key={option.value} role="menuitemradio" aria-checked={value===option.value} onClick={()=>select(option.value)}>{option.label}</button>)}</div>}</div></div>;
}
