import { useId, useState, type ReactNode } from "react";

/** A labelled, keyboard-accessible tooltip for a non-interactive product icon. */
export default function IconTooltip({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return <span className={`icon-tooltip ${className}`} tabIndex={0} aria-label={label} aria-describedby={dismissed ? undefined : id} onMouseEnter={()=>setDismissed(false)} onFocus={()=>setDismissed(false)} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setDismissed(true);}}}>
    {children}<span id={id} role="tooltip" className={`icon-tooltip-content ${dismissed ? 'is-dismissed' : ''}`}>{label}</span>
  </span>;
}
