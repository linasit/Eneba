import { useTranslation } from "../store/preferences";
import { useId, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
export type FilterSetter = (key:string,value:string|((current:string)=>string))=>void;
export type Facet = { facet: string; value: string; label: string; count: number };
type Option = { value: string; label: string; count: number };
const types = [["games","Game"],["dlc","DLC"],["egift-cards","eGift Cards"],["gaming-ecards","Gaming eCards"],["game-points","Game points"],["e-money","E-money Prepaid"],["software","Software"],["subscription","Subscription"],["mobile-games","Mobile games"],["mobile-recharges","Mobile recharges"],["esim","eSIM"]];
export const facetLabels: Record<string,string> = Object.fromEntries(types);
const systems = [["windows","Windows"],["mac","Mac"],["linux","Linux"],["android","Android"],["ios","iOS"]];
export const countries = [["lt","Lithuania"],["de","Germany"],["fr","France"],["us","United States"],["uk","United Kingdom"]];
export const filterNames: Record<string,string> = { type:"Product type",os:"Operating system",platform:"Platforms",genre:"Genres",region:"Regions",country:"Country",min:"Minimum price",max:"Maximum price",category:"Category",q:"Search" };
function FilterSection({ title, options, selected, toggle, searchable = true }: { title:string; options:Option[]; selected:string[]; toggle:(value:string)=>void; searchable?:boolean }) {
  const t = useTranslation();
  const [search,setSearch] = useState("");
  const [expanded,setExpanded] = useState(false);
  const id = useId();
  const matches = options.filter(option => `${t(option.label)} ${option.label}`.toLowerCase().includes(search.trim().toLowerCase()));
  const shown = expanded || search ? matches : matches.filter((option,index)=>index<8 || selected.includes(option.value));
  return <details className="store-filter-section" open><summary>{t(title)}<ChevronDown size={16}/></summary><div className="store-filter-body">
    {searchable && <div className="filter-search"><input type="search" aria-label={t("Search {0}", {0: t(title).toLowerCase()})} value={search} onChange={e=>setSearch(e.target.value)}/><Search size={18} aria-hidden="true"/></div>}
    <div className="filter-options">{shown.map(option=><label key={option.value} htmlFor={`${id}-${option.value}`}><input id={`${id}-${option.value}`} type="checkbox" checked={selected.includes(option.value)} onChange={()=>toggle(option.value)}/><span>{t(option.label)}</span><span className="filter-option-count">{option.count}</span></label>)}</div>
    {matches.length===0 && <p className="filter-no-options">{t("No matching options")}</p>}
    {!search && matches.length>8 && <button className="filter-more" onClick={()=>setExpanded(!expanded)}>{expanded ? t("Show less") : t("{0} more", {0: matches.length-shown.length})}<ChevronDown size={16} className={expanded ? "is-expanded":""}/></button>}
  </div></details>;
}
export default function StoreFilters({ facets, params, set, clear }: { facets:Facet[]; params:URLSearchParams; set:FilterSetter; clear:()=>void }) {
  const t = useTranslation();
  const selected = (key:string)=>(params.get(key)??"").split(",").filter(Boolean);
  const toggle = (key:string,value:string)=>{set(key,current=>{const values=current.split(",").filter(Boolean);return (values.includes(value)?values.filter(v=>v!==value):[...values,value]).join(",");});};
  const options = (key:string, defaults?:string[][]):Option[] => defaults ? defaults.map(([value,label])=>({value,label,count:facets.find(f=>f.facet===key&&f.value===value)?.count??0})) : facets.filter(f=>f.facet===key);
  return <div className="store-filter-content">
    <details className="store-filter-section" open><summary>{t("Price range (EUR)")}<ChevronDown size={16}/></summary><div className="store-filter-body filter-price-range">{["min","max"].map((key,index)=><span key={key}>{index===1&&<b>–</b>}<input type="number" min="0" max="1000000" step="0.01" key={params.get(key)??""} defaultValue={params.get(key)??""} aria-label={key==="min" ? t("Minimum price") : t("Maximum price")} onBlur={e=>{if(e.currentTarget.validity.valid)set(key,e.target.value);}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></span>)}</div></details>
    <details className="store-filter-section" open><summary>{t("Country")}<ChevronDown size={16}/></summary><div className="store-filter-body"><div className="filter-country"><select aria-label={t("Activation country")} value={params.get("country")??""} onChange={e=>set("country",e.target.value)}><option value="">{t("All countries")}</option>{countries.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select><ChevronDown size={16}/></div></div></details>
    {[["type","Product type",types],["os","Operating system",systems],["platform","Platforms"],["genre","Genres"],["region","Regions"]].map(([key,title,defaults])=><FilterSection key={key as string} title={title as string} options={options(key as string,defaults as string[][]|undefined)} selected={selected(key as string)} toggle={value=>toggle(key as string,value)} searchable={key!=="os"}/>)}
    <button className="store-clear-filters" onClick={clear}>{t("Clear filters")}</button>
  </div>;
}
