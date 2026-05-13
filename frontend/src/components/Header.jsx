import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingCart,
  User,
  Menu,
  X,
  ChevronRight,
  Facebook,
  Instagram,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import CartSidebar from "./CartSidebar";
import { fetchSiteSettings } from "../lib/siteSettingsApi";

function Header() {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { cart } = useCart();
  const { favorites } = useFavorites();
  const navigate = useNavigate();

  const [logoLight, setLogoLight] = useState("");
  const [logoDark, setLogoDark] = useState("");
  const [headerBgHex, setHeaderBgHex] = useState("");
  const [logoHeightPx, setLogoHeightPx] = useState(80);
  const [menuItems, setMenuItems] = useState([]);
  const [headerConfig, setHeaderConfig] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSiteSettings();

        const t = s?.theme || {};
        const h = t?.header || {};

        const hl = h?.logoLight || t?.logo?.light || "/LOGO1.png";
        const hd = h?.logoDark || t?.logo?.dark || "/LOGO1.png";
        setLogoLight(hl);
        setLogoDark(hd);

        const bg = String(h?.bgColor || "").trim();
        setHeaderBgHex(bg);

        const lh = Number(h?.logoHeightPx);
        if (!Number.isNaN(lh) && lh >= 30 && lh <= 160) setLogoHeightPx(lh);
        else setLogoHeightPx(80);

        setHeaderConfig(h);

        const headerMenu = Array.isArray(s?.menus?.header) ? s.menus.header : [];

        const mapped = headerMenu
          .map((it) => {
            const name = String(it?.title || "").trim();
            const to = String(it?.ref || "").trim();
            if (!name || !to) return null;

            const isExternal = /^https?:\/\//i.test(to);
            return { name, to, isExternal };
          })
          .filter(Boolean);

        setMenuItems(mapped);
      } catch {
        setLogoLight("/LOGO1.png");
        setLogoDark("/LOGO1.png");
        setHeaderBgHex("");
        setLogoHeightPx(80);
        setMenuItems([]);
        setHeaderConfig({});
      }
    })();
  }, []);

  useEffect(() => {
    function handleScroll() {
      if (window.scrollY > lastScrollY) setShowHeader(false);
      else setShowHeader(true);

      setLastScrollY(window.scrollY);
      setMenuOpen(false);
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    if (menuOpen || cartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, cartOpen]);

  const navStyle = useMemo(
    () => ({
      fontFamily: "var(--header-font-family)",
      fontSize: "var(--header-font-size)",
    }),
    []
  );

  const headerInlineStyle = useMemo(
    () => ({
      backgroundColor:
        "rgba(var(--header-bg-rgb, 255, 227, 236), var(--header-bg-alpha, 1))",
    }),
    []
  );

  const chosenLogo = useMemo(() => {
    const isHex = (v) =>
      typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

    const luminanceFromHex = (hex) => {
      if (!isHex(hex)) return null;
      let h = hex.replace("#", "").trim();
      if (h.length === 3) h = h
        .split("")
        .map((c) => c + c)
        .join("");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum = luminanceFromHex(headerBgHex);
    if (lum === null) return logoLight || "/LOGO1.png";

    const isDark = lum < 140;
    if (isDark) return logoLight || logoDark || "/LOGO1.png";
    return logoDark || logoLight || "/LOGO1.png";
  }, [headerBgHex, logoLight, logoDark]);

  const logoStyle = useMemo(
    () => ({
      height: `${Math.max(30, Math.min(160, Number(logoHeightPx) || 80))}px`,
      width: "auto",
    }),
    [logoHeightPx]
  );

  const mobileLogoStyle = useMemo(
    () => ({
      height: `${Math.max(26, Math.min(46, Number(logoHeightPx) || 40))}px`,
      width: "auto",
      maxWidth: "120px",
    }),
    [logoHeightPx]
  );

  const mobileMenuBgColor = headerConfig?.mobileMenuBgColor || "#fffdfd";
  const mobileMenuTextColor = headerConfig?.mobileMenuTextColor || "#1f1f1f";
  const mobileMenuBorderColor = headerConfig?.mobileMenuBorderColor || "#e7c2cf";
  const mobileMenuAccentColor = headerConfig?.mobileMenuAccentColor || "#b76e79";
  const mobileMenuMutedColor = headerConfig?.mobileMenuMutedColor || "#8a6b74";
  const mobileMenuTitleColor = headerConfig?.mobileMenuTitleColor || "#1f1f1f";

  const mobileMenuButtonBg = headerConfig?.mobileMenuButtonBg || "#d8b2bf";
  const mobileMenuButtonTextColor =
    headerConfig?.mobileMenuButtonTextColor || "#7b4f5f";
  const mobileMenuButtonBorderColor =
    headerConfig?.mobileMenuButtonBorderColor || mobileMenuButtonBg;
  const mobileMenuButtonBorderWidthPx = Number(
    headerConfig?.mobileMenuButtonBorderWidthPx ?? 0
  );
  const mobileMenuButtonRadiusPx = Number(
    headerConfig?.mobileMenuButtonRadiusPx ?? 999
  );

  const mobileMenuSecondaryButtonBg =
    headerConfig?.mobileMenuSecondaryButtonBg || "#ffffff";
  const mobileMenuSecondaryButtonTextColor =
    headerConfig?.mobileMenuSecondaryButtonTextColor || "#9d6275";
  const mobileMenuSecondaryButtonBorderColor =
    headerConfig?.mobileMenuSecondaryButtonBorderColor || "#c88ca1";
  const mobileMenuSecondaryButtonBorderWidthPx = Number(
    headerConfig?.mobileMenuSecondaryButtonBorderWidthPx ?? 1
  );
  const mobileMenuSecondaryButtonRadiusPx = Number(
    headerConfig?.mobileMenuSecondaryButtonRadiusPx ?? 999
  );

  const mobileMenuSocialBg = headerConfig?.mobileMenuSocialBg || "#c98ea2";
  const mobileMenuSocialIconColor =
    headerConfig?.mobileMenuSocialIconColor || "#ffffff";
  const mobileMenuSocialSizePx = Number(
    headerConfig?.mobileMenuSocialSizePx ?? 44
  );
  const mobileMenuFooterTextSizePx = Number(
    headerConfig?.mobileMenuFooterTextSizePx ?? 13
  );

  const mobileMenuOverlayColor =
    headerConfig?.mobileMenuOverlayColor || "#000000";
  const mobileMenuOverlayOpacity = Number(
    headerConfig?.mobileMenuOverlayOpacity ?? 0.35
  );

  const mobileMenuFontFamily = headerConfig?.mobileMenuFontFamily || "";
  const mobileMenuAnimation = headerConfig?.mobileMenuAnimation || "slide-left";
  const mobileMenuAnimationDurationMs = Number(
    headerConfig?.mobileMenuAnimationDurationMs ?? 300
  );
  const mobileMenuWidthPercent = Number(
    headerConfig?.mobileMenuWidthPercent ?? 88
  );

  const mobileMenuTriggerSizePx = Number(
    headerConfig?.mobileMenuTriggerSizePx ?? 40
  );
  const mobileMenuTriggerIconSizePx = Number(
    headerConfig?.mobileMenuTriggerIconSizePx ?? 20
  );
  const mobileMenuTriggerBgColor =
    headerConfig?.mobileMenuTriggerBgColor || "#ffffff";
  const mobileMenuTriggerIconColor =
    headerConfig?.mobileMenuTriggerIconColor || "#8d5c6b";
  const mobileMenuTriggerBorderColor =
    headerConfig?.mobileMenuTriggerBorderColor || "#d3a7b7";
  const mobileMenuTriggerBorderWidthPx = Number(
    headerConfig?.mobileMenuTriggerBorderWidthPx ?? 1
  );
  const mobileMenuTriggerRadiusPx = Number(
    headerConfig?.mobileMenuTriggerRadiusPx ?? 999
  );

  const mobileMenuCloseBgColor =
    headerConfig?.mobileMenuCloseBgColor || "#ffffff";
  const mobileMenuCloseIconColor =
    headerConfig?.mobileMenuCloseIconColor || "#8d5c6b";
  const mobileMenuCloseBorderColor =
    headerConfig?.mobileMenuCloseBorderColor || "#e7c2cf";
  const mobileMenuCloseBorderWidthPx = Number(
    headerConfig?.mobileMenuCloseBorderWidthPx ?? 1
  );
  const mobileMenuCloseRadiusPx = Number(
    headerConfig?.mobileMenuCloseRadiusPx ?? 999
  );

  const mobileMenuBorderWidthPx = Number(
    headerConfig?.mobileMenuBorderWidthPx ?? 0
  );
  const mobileMenuItemBorderColor =
    headerConfig?.mobileMenuItemBorderColor || "#e7c2cf";
  const mobileMenuItemBorderWidthPx = Number(
    headerConfig?.mobileMenuItemBorderWidthPx ?? 1
  );
  const mobileMenuRadiusPx = Number(headerConfig?.mobileMenuRadiusPx ?? 0);
  const mobileMenuPaddingPx = Number(headerConfig?.mobileMenuPaddingPx ?? 20);
  const mobileMenuLayout = headerConfig?.mobileMenuLayout || "drawer-left";

  const mobileMenuTriggerRadius =
    mobileMenuTriggerRadiusPx === 999 ? "999px" : `${mobileMenuTriggerRadiusPx}px`;
  const mobileMenuCloseRadius =
    mobileMenuCloseRadiusPx === 999 ? "999px" : `${mobileMenuCloseRadiusPx}px`;
  const mobileMenuButtonRadius =
    mobileMenuButtonRadiusPx === 999 ? "999px" : `${mobileMenuButtonRadiusPx}px`;
  const mobileMenuSecondaryRadius =
    mobileMenuSecondaryButtonRadiusPx === 999
      ? "999px"
      : `${mobileMenuSecondaryButtonRadiusPx}px`;

  const drawerBorderRadius =
    mobileMenuRadiusPx > 0 ? `${mobileMenuRadiusPx}px` : "0px";

  const overlayStyle = {
    backgroundColor: mobileMenuOverlayColor,
    opacity: menuOpen ? mobileMenuOverlayOpacity : 0,
    transitionDuration: `${mobileMenuAnimationDurationMs}ms`,
  };

  const triggerStyle = {
    width: `${mobileMenuTriggerSizePx}px`,
    height: `${mobileMenuTriggerSizePx}px`,
    backgroundColor: mobileMenuTriggerBgColor,
    color: mobileMenuTriggerIconColor,
    borderColor: mobileMenuTriggerBorderColor,
    borderWidth: `${mobileMenuTriggerBorderWidthPx}px`,
    borderRadius: mobileMenuTriggerRadius,
  };

  const closeButtonStyle = {
    width: "40px",
    height: "40px",
    backgroundColor: mobileMenuCloseBgColor,
    color: mobileMenuCloseIconColor,
    borderColor: mobileMenuCloseBorderColor,
    borderWidth: `${mobileMenuCloseBorderWidthPx}px`,
    borderRadius: mobileMenuCloseRadius,
  };

  const socialButtonStyle = {
    width: `${mobileMenuSocialSizePx}px`,
    height: `${mobileMenuSocialSizePx}px`,
    backgroundColor: mobileMenuSocialBg,
    color: mobileMenuSocialIconColor,
  };

  const primaryButtonStyle = {
    backgroundColor: mobileMenuButtonBg,
    color: mobileMenuButtonTextColor,
    borderColor: mobileMenuButtonBorderColor,
    borderWidth: `${mobileMenuButtonBorderWidthPx}px`,
    borderRadius: mobileMenuButtonRadius,
  };

  const secondaryButtonStyle = {
    backgroundColor: mobileMenuSecondaryButtonBg,
    color: mobileMenuSecondaryButtonTextColor,
    borderColor: mobileMenuSecondaryButtonBorderColor,
    borderWidth: `${mobileMenuSecondaryButtonBorderWidthPx}px`,
    borderRadius: mobileMenuSecondaryRadius,
  };

  const drawerWidth =
    mobileMenuLayout === "full-screen"
      ? "100%"
      : mobileMenuLayout === "center-panel"
      ? `${Math.min(mobileMenuWidthPercent, 92)}%`
      : `${mobileMenuWidthPercent}%`;

  const drawerMaxWidth = mobileMenuLayout === "full-screen" ? "100%" : "390px";

  const isRightLayout = mobileMenuLayout === "drawer-right";
  const isCenterLayout = mobileMenuLayout === "center-panel";
  const isFullLayout = mobileMenuLayout === "full-screen";

  const closedTransform =
    mobileMenuAnimation === "fade"
      ? isCenterLayout
        ? "translate(-50%, 0) scale(1)"
        : "translateX(0)"
      : mobileMenuAnimation === "scale"
      ? isCenterLayout
        ? "translate(-50%, 0) scale(0.96)"
        : "scale(0.96)"
      : mobileMenuAnimation === "slide-fade"
      ? isCenterLayout
        ? "translate(-50%, 20px)"
        : isRightLayout
        ? "translateX(40px)"
        : "translateX(-40px)"
      : isCenterLayout
      ? "translate(-50%, 20px)"
      : isRightLayout
      ? "translateX(100%)"
      : "translateX(-100%)";

  const openTransform = isCenterLayout ? "translate(-50%, 0)" : "translateX(0)";

  const asideStyle = {
    width: drawerWidth,
    maxWidth: drawerMaxWidth,
    backgroundColor: mobileMenuBgColor,
    borderColor: mobileMenuBorderColor,
    borderWidth: `${mobileMenuBorderWidthPx}px`,
    borderStyle: "solid",
    borderRadius: drawerBorderRadius,
    paddingLeft: `${mobileMenuPaddingPx}px`,
    paddingRight: `${mobileMenuPaddingPx}px`,
    transitionDuration: `${mobileMenuAnimationDurationMs}ms`,
    fontFamily: mobileMenuFontFamily || undefined,
    opacity: menuOpen ? 1 : mobileMenuAnimation === "fade" || mobileMenuAnimation === "slide-fade" || mobileMenuAnimation === "scale" ? 0 : 1,
    transform: menuOpen ? openTransform : closedTransform,
    left: isRightLayout ? "auto" : isCenterLayout ? "50%" : "0",
    right: isRightLayout ? "0" : "auto",
    top: "0",
    height: "100%",
  };

  const closeMenuAndNavigate = (to) => {
    setMenuOpen(false);
    navigate(to);
  };

  return (
    <>
      <header
        style={headerInlineStyle}
        className={`theme-header px-4 rounded-b-2xl shadow-md fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="relative w-full h-[70px]">
          {/* Desktop */}
          <div className="hidden md:flex w-full h-full items-center justify-between">
            <NavLink to="/" className="shrink-0 z-10">
              <img
                src={chosenLogo || "/LOGO1.png"}
                alt="Logo Rosa Boutique"
                style={logoStyle}
                className="object-contain"
              />
            </NavLink>

            <nav
              style={navStyle}
              className="header-menu flex justify-center space-x-6 font-bold italic drop-shadow-[0_0_3px_#FFFFFF]"
            >
              {menuItems.map((item, idx) => {
                if (item.isExternal) {
                  return (
                    <a
                      key={idx}
                      href={item.to}
                      target="_blank"
                      rel="noreferrer"
                      className="transition duration-300"
                    >
                      {item.name}
                    </a>
                  );
                }

                return (
                  <NavLink
                    key={idx}
                    to={item.to}
                    className={({ isActive }) =>
                      `transition duration-300 ${isActive ? "font-bold underline" : ""}`
                    }
                  >
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>

            <div className="header-icons flex items-center space-x-4 text-xl">
              <div
                onClick={() => navigate("/admin/login")}
                className="header-icon relative cursor-pointer"
              >
                <User className="w-5 h-5" />
              </div>

              <div
                onClick={() => navigate("/")}
                className="header-icon relative cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </div>

              <div
                onClick={() => navigate("/favoritos")}
                className="header-icon relative cursor-pointer"
              >
                <Heart className="w-5 h-5" />
                {favorites.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow">
                    {favorites.length}
                  </span>
                )}
              </div>

              <div
                onClick={() => setCartOpen(true)}
                className="header-icon relative cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow">
                    {cart.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden h-full">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex items-center justify-center shadow-sm"
                style={triggerStyle}
                aria-label="Abrir menú"
              >
                <Menu
                  className="shrink-0"
                  style={{
                    width: `${mobileMenuTriggerIconSizePx}px`,
                    height: `${mobileMenuTriggerIconSizePx}px`,
                  }}
                />
              </button>
            </div>

            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
              <div
                onClick={() => navigate("/favoritos")}
                className="relative cursor-pointer text-[#8d5c6b] bg-white shadow-sm border border-[#e7c2cf] rounded-full w-10 h-10 flex items-center justify-center"
              >
                <Heart className="w-5 h-5" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#D4AF37] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow">
                    {favorites.length}
                  </span>
                )}
              </div>

              <div
                onClick={() => setCartOpen(true)}
                className="relative cursor-pointer text-[#8d5c6b] bg-white shadow-sm border border-[#e7c2cf] rounded-full w-10 h-10 flex items-center justify-center"
              >
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow">
                    {cart.length}
                  </span>
                )}
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <NavLink to="/" className="pointer-events-auto flex items-center justify-center">
                <img
                  src={chosenLogo || "/LOGO1.png"}
                  alt="Logo Rosa Boutique"
                  style={mobileLogoStyle}
                  className="object-contain block"
                />
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`md:hidden fixed inset-0 z-[70] transition-all ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={overlayStyle}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className="md:hidden fixed z-[80] shadow-2xl flex flex-col transition-all"
        style={asideStyle}
      >
        <div
          className="relative flex items-center justify-between pt-5 pb-4"
          style={{
            borderBottom: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}`,
          }}
        >
          <img
            src={chosenLogo || "/LOGO1.png"}
            alt="Logo Rosa Boutique"
            className="h-12 object-contain"
          />

          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center shadow-sm"
            style={closeButtonStyle}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col">
            {menuItems.length > 0 ? (
              menuItems.map((item, idx) => {
                const itemStyle = {
                  color: mobileMenuTextColor,
                  borderBottom: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}`,
                };

                const chevronStyle = {
                  color: mobileMenuMutedColor,
                };

                if (item.isExternal) {
                  return (
                    <a
                      key={idx}
                      href={item.to}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between py-4 text-[17px] font-semibold transition"
                      style={itemStyle}
                    >
                      <span>{item.name}</span>
                      <ChevronRight className="w-4 h-4" style={chevronStyle} />
                    </a>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => closeMenuAndNavigate(item.to)}
                    className="flex items-center justify-between py-4 text-[17px] font-semibold transition text-left"
                    style={itemStyle}
                  >
                    <span>{item.name}</span>
                    <ChevronRight className="w-4 h-4" style={chevronStyle} />
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-sm" style={{ color: mobileMenuMutedColor }}>
                No hay opciones de menú configuradas.
              </div>
            )}
          </nav>

          <div className="pt-8">
            <div
              className="mb-4 text-[18px] font-semibold"
              style={{ color: mobileMenuTitleColor }}
            >
              Mi cuenta
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => closeMenuAndNavigate("/admin/login")}
                className="w-full font-semibold py-3 px-4 transition hover:opacity-90"
                style={primaryButtonStyle}
              >
                Inicia sesión
              </button>

              <button
                type="button"
                onClick={() => closeMenuAndNavigate("/admin/login")}
                className="w-full font-semibold py-3 px-4 transition"
                style={secondaryButtonStyle}
              >
                Registro
              </button>
            </div>

            <div className="pt-8 flex items-center gap-3">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center shadow-sm transition hover:scale-105"
                style={socialButtonStyle}
              >
                <Facebook className="w-5 h-5" />
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center shadow-sm transition hover:scale-105"
                style={socialButtonStyle}
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div
          className="py-5 text-center leading-6"
          style={{
            color: mobileMenuMutedColor,
            fontSize: `${mobileMenuFooterTextSizePx}px`,
            borderTop: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}`,
          }}
        >
          Todos los derechos reservados
          <br />
          © 2026, Rosa Boutique
        </div>
      </aside>

      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

export default Header;