import { useTranslation } from "../store/preferences";
import { Link } from "react-router-dom";

const suggestions = [
  ["Steam Games", "platform=steam"], ["Steam Gift Cards", "category=steam-gift-cards"],
  ["Xbox Live Gift Cards", "category=xbox&type=gaming-ecards"], ["PSN Gift Cards", "category=psn&type=gaming-ecards"],
  ["Valorant Points (Riot)", "q=Valorant"], ["DLCs", "type=dlc"], ["Software", "type=software"], ["Games", "type=games"],
  ["Game Points", "type=game-points"], ["Fortnite V-Bucks", "q=Fortnite+V-Bucks"], ["Xbox Game Pass Essential", "q=Xbox+Game+Pass"],
  ["Robux | Roblox Gift Cards", "q=Roblox"], ["GTA Online Cash", "q=GTA+Online+Cash"], ["NBA VC", "q=NBA+VC"],
  ["Razer Gold Gift Cards", "q=Razer+Gold"], ["Discord Gift Cards", "q=Discord"], ["Gaming eCards", "type=gaming-ecards"],
  ["eGift Cards", "type=egift-cards"], ["Mobile recharges", "type=mobile-recharges"], ["Popular eGift Cards", "type=egift-cards&sort=popular"],
  ["TikTok Coins", "q=TikTok+Coins"], ["Fortnite Skins", "q=Fortnite+Skins"],
];

export default function StoreGuide() {
  const t = useTranslation();
  return <section className="store-guide" aria-labelledby="store-guide-title">
    <nav className="store-suggestions" aria-label={t("Related store categories")}>
      <p>{t("You may also be interested in:")}</p>
      <div>{suggestions.map(([label, query]) => <Link key={label} to={`/store?${query}`}>{t(label)}</Link>)}</div>
    </nav>
    <h2 id="store-guide-title">{t("Buy games, gift cards, and top-ups on Eneba")}</h2>
    <p>{t("Explore games, gift cards, top-ups, e-money, and software in one place. Browse the categories below and compare the offers available in this demo catalog.")}</p>
    <h3>{t("Games and DLCs")}</h3>
    <p>{t("Find your next adventure, from new releases to familiar favorites. Browse ")}<Link to="/store?type=games&max=10">{t("cheap games under €10")}</Link>{t(", explore ")}<Link to="/store?platform=xbox&type=games">{t("Xbox games")}</Link>{t(", or discover ")}<Link to="/store?category=psn&type=games">{t("PlayStation games")}</Link>{t(". Planning a game night? Take a look at ")}<Link to="/store?platform=nintendo">{t("Nintendo Switch games")}</Link>.</p>
    <p>{t("Looking ahead to your next big release? Browse ")}<Link to="/store?category=pre-orders">{t("upcoming pre-orders")}</Link> {t(" and compare the available listings.")}</p>
    <h3>{t("Gift cards and eGift cards")}</h3>
    <p>{t("Explore gift cards for gaming platforms, shops, and digital services. Discover ")}<Link to="/store?q=Amazon&type=egift-cards">{t("Amazon gift cards")}</Link>, <Link to="/store?q=Apple&type=egift-cards">{t("Apple gift cards")}</Link>{t(", and ")}<Link to="/store?q=Google+Play">{t("Google Play gift cards")}</Link>{t(", or browse ")}<Link to="/store?platform=nintendo&type=gaming-ecards">{t("Nintendo eShop cards")}</Link> {t(" and ")}<Link to="/store?type=gaming-ecards">{t("gaming eCards")}</Link> {t(" for your favorite platforms.")}</p>
    <h2>{t("Game points and mobile top-ups")}</h2>
    <p>{t("Explore in-game currency and game points, including ")}<Link to="/store?q=FC+Points">{t("FIFA / FC Points")}</Link>, <Link to="/store?q=Apex+Coins">{t("Apex Coins")}</Link>{t(", and ")}<Link to="/store?q=CoD+Points">{t("CoD Points")}</Link>{t(". Playing on the go? Browse ")}<Link to="/store?category=top-up-games">{t("mobile game top-ups")}</Link> {t(" to find relevant listings.")}</p>
    <p>{t("You can also search for ")}<Link to="/store?q=Nexon+Cash">{t("Nexon Cash gift cards")}</Link> {t(" for Nexon games.")}</p>
    <h3>{t("E-money and software")}</h3>
    <p>{t("There is more to explore beyond games. Search for ")}<Link to="/store?q=PayPal+top-ups">{t("PayPal top-ups")}</Link>, <Link to="/store?q=Windows+11&type=software">{t("Windows 11 keys")}</Link>{t(", and ")}<Link to="/store?platform=steam&type=software">{t("Steam software")}</Link>{t(", or browse security software such as ")}<Link to="/store?q=NordVPN&type=software">{t("NordVPN")}</Link>.</p>
    <h3>{t("Why browse this marketplace?")}</h3>
    <p>{t("Compare seller offers, narrow your search by platform, region, and price, and keep your favorites in your wishlist. This independent demo uses simulated payments and test keys. Some categories have no products yet.")}</p>
  </section>;
}
