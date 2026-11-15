import { useTranslation } from "../store/preferences";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Circle } from "lucide-react";
import Brand from "../components/Brand";
import { useAuth } from "../store/auth";

export default function Login() {
  const t = useTranslation();
  const [params] = useSearchParams();
  const loc = useLocation();
  const register = loc.pathname === '/register' || params.get('mode') === 'register';
  const [code,setCode]=useState('');
  const [needsCode,setNeedsCode]=useState(false);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [visible,setVisible] = useState(false);
  const [error,setError] = useState('');
  const [pending,setPending] = useState(false);
  const auth = useAuth();
  const nav = useNavigate();
  const longEnough = password.length >= 8;
  const hasNumber = /[0-9\W_]/u.test(password);
  async function submit(event:FormEvent) {
    event.preventDefault(); setError('');
    if(register && password !== confirmation) {setError(t('Passwords do not match.'));return;}
    if(register && (!longEnough || !hasNumber)) {setError(t('Use at least 8 characters and one number or special character.'));return;}
    setPending(true);
    try {
      const normalizedEmail=email.trim().toLowerCase();
      if(register) await auth.register(normalizedEmail, normalizedEmail.split('@')[0].padEnd(2,'_').slice(0,40),password);
      else await auth.login(normalizedEmail,password,code);
      const from=loc.state?.from;
      nav(typeof from==='string' && from.startsWith('/') && !from.startsWith('//') ? from : '/orders',{replace:true});
    } catch(error) {if((error as Error).message==='Two-step verification code required')setNeedsCode(true);setError(t((error as Error).message));} finally {setPending(false);}
  }
  return <main className="reference-auth-screen">
    <div className="auth-home-brand"><Brand/></div>
    <div className="reference-auth-layout">
      <section className="reference-auth-welcome" aria-label={t('Welcome')}><h1>{t('Hello!')}<br/>{t('Nice to')}<br/>{t('see you!')}</h1></section>
      <section className="reference-auth-panel" aria-labelledby="auth-title">
        <h2 id="auth-title">{register ? t('Create account') : t('Log in')}</h2>
        <p className="auth-switch">{register ? t('Already have an account?') : t('New user?')}{' '}<Link to={register ? '/login' : '/register'} state={loc.state} onClick={()=>{setError('');setPassword('');setConfirmation('');}}>{register ? t('Sign in') : t('Create an account')}</Link></p>
        <form onSubmit={submit} aria-busy={pending}>
          <label className="auth-field"><span>{t('Email address')}</span><input type="email" autoComplete="email" placeholder={t('Email address')} required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/></label>
          <label className="auth-field"><span>{t('Password')}</span><input type={visible?'text':'password'} autoComplete={register?'new-password':'current-password'} placeholder={t('Password')} required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} disabled={pending}/></label>
          {register && <label className="auth-field"><span>{t('Repeat password')}</span><input type={visible?'text':'password'} autoComplete="new-password" placeholder={t('Repeat password')} required minLength={8} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={pending}/></label>}
          <button type="button" className="auth-password-toggle" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?t('Hide password'):t('Show password')}</button>
          {register && <ul className="auth-password-rules"><li className={longEnough?'is-met':''}>{longEnough?<Check size={13}/>:<Circle size={13}/>} {t('At least 8 characters')}</li><li className={hasNumber?'is-met':''}>{hasNumber?<Check size={13}/>:<Circle size={13}/>} {t('At least one number (0–9) or special character')}</li></ul>}
          {!register&&needsCode&&<label className="auth-field"><span>{t('Verification code')}</span><input placeholder={t('Verification code')} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="reference-auth-submit" type="submit" disabled={pending}>{pending?t('Please wait…'):register?t('Create account'):t('Log in')}</button>
        </form>
        <Link className="auth-back-store" to="/">{t('Back to store')}</Link>
      </section>
    </div>
  </main>;
}
