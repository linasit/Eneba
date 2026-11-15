import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import messages from '../lib/locales/lt.json';
import { countryCodes, countryName, currencyCodes, languageOptions, type Currency, type Language } from '../lib/localeOptions';
export type Preferences = { region: string; language: Language; currency: Currency };
export const usePreferences = create<Preferences & { save:(preferences:Preferences)=>void }>()(persist(set => ({
  region:'Europe', language:'en', currency:'EUR', save:preferences=>set(preferences),
}), {
  name:'eneba-preferences', version:2, migrate:state=>state,
  merge:(persisted,current)=>{
    const saved=(persisted??{}) as Partial<Preferences>;
    return {...current,region:typeof saved.region==='string'?saved.region:current.region,language:languageOptions.some(option=>option.value===saved.language)?saved.language!:'en',currency:currencyCodes.includes(saved.currency as Currency)?saved.currency!:current.currency};
  },
}));
export type TranslationValues = Record<string,string|number|null|undefined>;
const lt:Record<string,string> = messages;
const countries = new Map(countryCodes.map(code=>[countryName(code,'en'),countryName(code,'lt')]));
function catalogText(text:string) {
  const description=text.match(/^Experience (.+) and discover your next great adventure\. Instant digital delivery, ready to activate on your platform\. Compare trusted sellers and choose the offer that works for you\.$/);
  if(description)return `Atraskite „${description[1]}“ ir naujus nuotykius. Momentinis skaitmeninis pristatymas, paruošta aktyvinti jūsų platformoje. Palyginkite pardavėjus ir pasirinkite tinkamą pasiūlymą.`;
  if(!/\b(?:Key|Gift Card|Edition)\b/.test(text))return text;
  let result=text.replace(/\bSteam Gift\b/g,'Steam dovana').replace(/\bGift Card\b/g,'dovanų kortelė').replace(/\bNetwork Card\b/g,'Network kortelė').replace(/\bKey\b/g,'raktas').replace(/\b1 Month\b/g,'1 mėnesio');
  for(const [name,localized] of countries)result=result.replaceAll(name.toUpperCase(),localized.toUpperCase());
  return result.replace(/\bTURKEY\b/g,'TURKIJA').replace(/\bOfficial website\b/g,'Oficiali svetainė').replace(/\bGLOBAL\b/g,'VISAME PASAULYJE').replace(/\bEUROPE\b/g,'EUROPA').replace(/\bLATIN AMERICA\b/g,'LOTYNŲ AMERIKA');
}
export function translate(text:string|null|undefined,language:Language,values:TranslationValues={}) {
  if(text==null)return '';
  const key=text.trim();
  const output=language!=='lt'?key:(lt[key]??countries.get(key)??countries.get(key.charAt(0)+key.slice(1).toLowerCase())?.toUpperCase()??catalogText(key));
  const prefix=text.match(/^\s*/)?.[0]??'',suffix=text.match(/\s*$/)?.[0]??'';
  return prefix+output.replace(/\{(\w+)\}/g,(match,name)=>values[name]==null?match:String(values[name]))+suffix;
}
export function useTranslation() {
  const language=usePreferences(state=>state.language);
  return (text:string|null|undefined,values?:TranslationValues)=>translate(text,language,values);
}
export function useItemCount() {
  const language=usePreferences(state=>state.language);
  return (count:number)=>language!=='lt'?`${count} ${count===1?'item':'items'}`:`${count} ${new Intl.PluralRules('lt').select(count)==='one'?'prekė':new Intl.PluralRules('lt').select(count)==='few'?'prekės':'prekių'}`;
}
