import { useTranslation } from "../store/preferences";
import { Link } from "react-router-dom";
export default function Brand(){
  const t = useTranslation();return <Link to="/" className="brand" aria-label={t("Eneba home")}><img className="brand-logo" src="/reference/logo.svg" width="156" height="49" alt={t("Eneba")}/></Link>}
