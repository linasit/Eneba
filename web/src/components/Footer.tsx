import { useTranslation } from "../store/preferences";
import LocaleSettings from "./LocaleSettings";
import data from "./footer-data.json";

const root = "/reference/footer/";
const external = { target: "_blank", rel: "noopener noreferrer" };
const payments = [
  ["wallet", "Eneba Wallet"], ["braintree_paypal", "PayPal"],
  ["payrails_card", "Visa and Mastercard"], ["payrails_apple_pay", "Apple Pay"],
  ["payrails_google_pay", "Google Pay"], ["nuvei_crypto", "Pay with Crypto"],
];
export default function Footer({account=false}:{account?:boolean}) {
  const t = useTranslation();
  return (
    <footer className={`reference-footer${account?" account-footer":""}`}>
      <div className="payment-strip" aria-label={t("Eneba payment methods (reference)")}>
        <div className="container payment-logos">
          {payments.map(([file, label]) => <img key={file} src={`${root}${file}.svg`} alt={t(label)} loading="lazy" />)}
        </div>
      </div>
      <div className="container footer-content">
        <div className="reference-footer-grid">
          {data.links.map(group => (
            <nav key={group.title} aria-label={t(group.title)}>
              <h3>{t(group.title)}</h3>
              <ul>{group.links.filter(link=>!account||!["Eneba Trust & Transparency","Loyalty program"].includes(link.label)).map(link => <li key={link.label}><a href={link.href} {...external}>{t(link.label)}</a></li>)}</ul>
            </nav>
          ))}
          <div className="footer-social-column">
            <h3>{t("Follow us")}</h3>
            <div className="footer-social-links">
              {data.social.map(social => <a key={social.name} href={social.href} aria-label={t("Eneba on {0}", {0: social.name})} {...external}><img src={`${root}${social.name.toLowerCase()}.svg`} width="20" height="20" alt="" loading="lazy" /></a>)}
            </div>
            <a className="footer-editor-award" href="https://www.eneba.com/about-us" aria-label={t("Eneba Editor’s Choice award")} {...external}>
              <img src={`${root}pcmag.svg`} alt={t("PC Mag")} width="43" height="43" loading="lazy" /><span>{t("EDITOR’S")}<br />{t("CHOICE")}</span>
            </a>
            <a href="https://www.eneba.com/" aria-label={t("Eneba and Monster Energy")} {...external}><img className="footer-monster" src={`${root}monster.png`} alt={t("Monster Energy")} loading="lazy" /></a>
          </div>
          <div className="footer-download">
            <h3>{t(account?"The app makes it easier!":"Download the App")}</h3>
            <a href="https://play.google.com/store/apps/details?id=com.eneba.app" {...external}><img src={`${root}google-play.svg`} width="136" height="40" alt={t("Get Eneba on Google Play")} loading="lazy" /></a>
            <a href="https://apps.apple.com/app/apple-store/id1564406362" {...external}><img src={`${root}app-store.svg`} width="135" height="40" alt={t("Download Eneba on the App Store")} loading="lazy" /></a>
          </div>
          <div className="footer-reviews">
            <h3>{t("See our reviews on")}</h3>
            <a href="https://www.trustpilot.com/review/eneba.com" {...external} aria-label={t("Read Eneba’s reviews on Trustpilot")}>
              <span className="trustpilot-name"><span aria-hidden="true">★</span>{t("Trustpilot")}</span>
              <span className="trustpilot-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <span key={i}>★</span>)}</span>
              <span className="trustpilot-caption">{t("Read Eneba’s customer reviews")}</span>
            </a>
          </div>
        </div>
        <div className="reference-footer-bottom">
          <span>© {new Date().getFullYear()} {t(" Eneba demo · Independent demo · Simulated payments · Test keys only")}</span>
          <div><a href="https://www.eneba.com/terms-and-conditions" {...external}>{t("Terms and Conditions")}</a><a href="https://www.eneba.com/privacy-policy" {...external}>{t("Privacy notice")}</a><LocaleSettings footer /></div>
        </div>
      </div>
    </footer>
  );
}
