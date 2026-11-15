import CartPanel from "./components/CartPanel";
import CategoryMenu from "./components/CategoryMenu";
import AddedToCartModal from "./components/AddedToCartModal";
import LocaleSettings from "./components/LocaleSettings";
import { useTranslation, usePreferences } from "./store/preferences";
import React, { useState } from "react";
import {
  ShoppingCart,
  UserRound,
  Menu,
  Heart,
  Search,
  X,
} from "lucide-react";
import Footer from "./components/Footer";
import Brand from "./components/Brand";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/tokens.css";
import { AuthProvider, useAuth } from "./store/auth";
import { useCart } from "./store/cart";
import SearchBar from "./components/SearchBar";
import ScrollToTop from "./components/ScrollToTop";
import RequireAuth from "./components/RequireAuth";
import Wishlist from "./pages/Wishlist";
import Home from "./pages/Home";
import Store from "./pages/Store";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders"; // list of /api/orders (same card pattern)
import UserMenu from "./components/UserMenu";
import Account from "./pages/Account";
import Login from "./pages/Login"; // login + register forms calling useAuth()

function Header() {
  const t = useTranslation();
  const language = usePreferences(s=>s.language);
  const { user, logout } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  return (
    <header
      className={`site-header ${searchOpen ? "search-is-open" : ""} ${menuOpen ? "menu-is-open" : ""}`}
    >
      <div className="container main-header">
        <button
          className="mobile-menu-button"
          aria-label={menuOpen ? t("Close categories") : t("Open categories")}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-controls="header-categories"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
        <Brand />
        <SearchBar />
        <LocaleSettings />
        <div className="account-actions">
          <button
            className="mobile-search-button"
            aria-label={searchOpen ? t("Close search") : t("Open search")}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            {searchOpen ? <X size={25} /> : <Search size={25} />}
          </button>
          <Link to="/wishlist" className="header-icon" aria-label={t("Wishlist")}>
            <Heart size={25} />
          </Link>
          <button
            onClick={() => setCartOpen(true)}
            aria-haspopup="dialog" aria-expanded={cartOpen} aria-controls="shopping-cart-dialog"
            className="cart-link"
            aria-label={t("Cart, {0} items", {0: count})}
          >
            <ShoppingCart size={26} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </button>
          {user ? (
            <UserMenu/>
          ) : (
            <Link to="/login" className="login-link">
              <UserRound size={26} />
              <span>{t("Log in | Register")}</span>
            </Link>
          )}
        </div>
      </div>
      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
      <CategoryMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="nav-background">
        <nav className="container category-nav" aria-label={t("Main navigation")}>
          <button className="category-menu category-drawer-trigger" aria-haspopup="dialog" aria-controls="header-categories" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu size={23} /> {t("Categories")}
          </button>
          <Link to="/store?sort=discount">{t("Cheap Games")}</Link>
          <Link to="/store?category=software">{t("Software")}</Link>
          <Link to="/store?category=egift-cards">{language === "lt" ? "E. kortelės" : t("eGift Cards")}</Link>
          <Link to="/store?category=gaming-ecards">{t("Eneba Gift Cards")}</Link>
          <Link to="/store?q=Probably%20Stolen">{t("PROBABLY STOLEN")}</Link>
          <Link className="header-gta-link" to="/store?q=Grand%20Theft%20Auto">{t("GTA 6")}</Link>
        </nav>
      </div>
    </header>
  );
}

function StoreChrome({children}:{children:React.ReactNode}) {
 const {pathname}=useLocation();
 return pathname==='/login' || pathname==='/register' || pathname.startsWith('/account') ? null : <>{children}</>;
}

function NotFound() {
 const t = useTranslation();
 return <main className="container page"><h1>{t('Page not found')}</h1><Link className="btn btn-primary" to="/store">{t('Explore games')}</Link></main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { staleTime: 30_000, refetchOnWindowFocus: false },
          },
        })
      }
    >
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <StoreChrome><Header /></StoreChrome>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/store" element={<Store />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/p/:slug" element={<Product />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/account/:section?" element={<RequireAuth><Account/></RequireAuth>} />
            <Route
              path="/checkout"
              element={
                <RequireAuth>
                  <Checkout />
                </RequireAuth>
              }
            />
            <Route
              path="/orders"
              element={
                <RequireAuth>
                  <Orders />
                </RequireAuth>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <RequireAuth>
                  <OrderDetail />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <NotFound />
              }
            />
          </Routes>
          <StoreChrome><Footer /></StoreChrome>
          <AddedToCartModal />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
