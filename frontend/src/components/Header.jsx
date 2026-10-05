import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from 'react-dom';
import {
  X,
  ChevronRight,
  Facebook,
  Instagram,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useFavorites } from "../context/FavoritesContext";
import CartSidebar from "./CartSidebar";
import { fetchSiteSettings } from "../lib/siteSettingsApi";
import { isDarkHeaderBackground, normalizeHeaderMenu, resolveHeaderLogo, resolveHeaderSurface, headerMenuDestination } from './headerPresentation';
import HeaderBrand from './HeaderBrand';
import { HeaderActionGlyph, resolveHeaderIcons } from './HeaderActionIcons';
import HeaderSearch from './HeaderSearch';
import { headerSearchColorVariables } from './headerSearchTheme';
import AtelierMobileMenu from './AtelierMobileMenu';
import WhatsAppMenuIcon from './WhatsAppMenuIcon';
import { resolveWhatsAppHref } from './whatsappLink';
import MobileMenuTrigger from './MobileMenuTrigger';

function Header() {
  const [showHeader, setShowHeader] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState('desktop');
  const searchTriggerRef = useRef(null);
  const searchCloseTimerRef = useRef(null);
  const desktopSearchAnchorRef = useRef(null);
  const mobileSearchAnchorRef = useRef(null);
  useEffect(() => () => window.clearTimeout(searchCloseTimerRef.current), []);
  const { cart } = useCart();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();

  const [logoLight, setLogoLight] = useState("");
  const [logoDark, setLogoDark] = useState("");
  const [headerBgHex, setHeaderBgHex] = useState("");
  const [logoHeightPx, setLogoHeightPx] = useState(80);
  const [menuItems, setMenuItems] = useState([]);
  const [headerConfig, setHeaderConfig] = useState({});
  const [themeColors, setThemeColors] = useState({});
  const iconPresentation = resolveHeaderIcons(headerConfig);
  const [footerConfig, setFooterConfig] = useState({});
  const [mobileMenuFeatureImage, setMobileMenuFeatureImage] = useState('');
  const [storeName, setStoreName] = useState('Rosa Boutique');
  const [whatsappConfig, setWhatsAppConfig] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    const refresh = async () => {
      const requestId = ++sequence;
      try {
        const s = await fetchSiteSettings();
        if (cancelled || requestId !== sequence) return;

        const t = s?.theme || {};
        const h = t?.header || {};

        const hl = h?.logoLight || t?.logo?.light || "";
        const hd = h?.logoDark || t?.logo?.dark || "";
        setLogoLight(hl);
        setLogoDark(hd);

        const bg = String(h?.bgColor || "").trim();
        setHeaderBgHex(bg);

        const lh = Number(h?.logoHeightPx);
        if (!Number.isNaN(lh) && lh >= 30 && lh <= 160) setLogoHeightPx(lh);
        else setLogoHeightPx(80);

        setHeaderConfig(h);
        setThemeColors(t?.colors || {});
        setFooterConfig(t?.footer || {});
        setMobileMenuFeatureImage(h?.mobileMenuFeatureImage || '');
        setStoreName(s?.store?.name || 'Rosa Boutique');
        setWhatsAppConfig(t?.global?.whatsapp || null);
        setMenuItems(normalizeHeaderMenu(s?.menus?.header));
      } catch {
        if (cancelled || requestId !== sequence) return;
        setLogoLight("");
        setLogoDark("");
        setHeaderBgHex("");
        setLogoHeightPx(80);
        setMenuItems([]);
        setHeaderConfig({});
        setThemeColors({});
        setFooterConfig({});
        setMobileMenuFeatureImage('');
        setStoreName('Rosa Boutique');
        setWhatsAppConfig(null);
      }
    };
    refresh();
    const onStorage = (event) => {
      if (event.key === 'rb_site_settings_tick') refresh();
    };
    window.addEventListener('rb_site_settings_updated', refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('rb_site_settings_updated', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let previousY = window.scrollY;
    function handleScroll() {
      const currentY = window.scrollY;
      if (!menuOpen && !cartOpen && !searchOpen && Math.abs(currentY - previousY) > 4) {
        setShowHeader(currentY < 80 || currentY < previousY);
      }
      previousY = currentY;
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [menuOpen, cartOpen, searchOpen]);

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

  useEffect(() => {
    setShowHeader(true);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const navStyle = useMemo(
    () => ({
      fontFamily: "var(--header-font-family)",
      fontSize: "var(--header-font-size)",
    }),
    []
  );

  const headerSurface = useMemo(() => resolveHeaderSurface(headerConfig), [headerConfig]);
  const headerInlineStyle = {
    ...headerSurface.style,
    ...headerSearchColorVariables(headerConfig, themeColors),
    '--header-icon-color': headerConfig.iconColor || headerConfig.textColor || (isDarkHeaderBackground(headerBgHex) ? '#ffffff' : '#9d4268'),
    '--header-icon-hover': headerConfig.iconHoverColor || '#c62d6a',
    '--storefront-action-size': `${Math.max(28, Math.min(40, Number(headerConfig.iconSizePx) || 34))}px`,
    backgroundColor: `rgba(var(--header-bg-rgb, 255, 227, 236), ${headerSurface.opacity})`,
  };

  const chosenLogo = useMemo(() => resolveHeaderLogo({ bgColor: headerBgHex, logoLight, logoDark, logoMode: headerConfig.logoMode }), [headerBgHex, logoLight, logoDark, headerConfig.logoMode]);
  const alternateLogo = chosenLogo === logoLight ? logoDark : logoLight;

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
      maxWidth: "clamp(76px, 24vw, 120px)",
    }),
    [logoHeightPx]
  );

  const mobileMenuLayout = headerConfig?.mobileMenuLayout || 'atelier-sheet';
  const isAtelierSheet = mobileMenuLayout === 'atelier-sheet';
  const mobileMenuBgColor = headerConfig?.mobileMenuBgColor || (isAtelierSheet ? '#fff4f3' : '#fffdfd');
  const mobileMenuTextColor = headerConfig?.mobileMenuTextColor || (isAtelierSheet ? '#4e1e39' : '#1f1f1f');
  const mobileMenuBorderColor = headerConfig?.mobileMenuBorderColor || "#e7c2cf";
  const mobileMenuAccentColor = headerConfig?.mobileMenuAccentColor || (isAtelierSheet ? '#ac7950' : '#b76e79');
  const mobileMenuMutedColor = headerConfig?.mobileMenuMutedColor || (isAtelierSheet ? '#815269' : '#8a6b74');
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
    headerConfig?.mobileMenuOverlayColor || (isAtelierSheet ? '#54233d' : '#000000');
  const mobileMenuOverlayOpacity = Number(
    headerConfig?.mobileMenuOverlayOpacity ?? (isAtelierSheet ? 0.22 : 0.35)
  );

  const mobileMenuFontFamily = headerConfig?.mobileMenuFontFamily || "";
  const mobileMenuAnimation = headerConfig?.mobileMenuAnimation || "slide-left";
  const mobileMenuAnimationDurationMs = Number(
    headerConfig?.mobileMenuAnimationDurationMs ?? 300
  );
  const mobileMenuWidthPercent = Number(
    headerConfig?.mobileMenuWidthPercent ?? 88
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
    headerConfig?.mobileMenuItemBorderColor || (isAtelierSheet ? '#d2a997' : '#e7c2cf');
  const mobileMenuItemBorderWidthPx = Number(
    headerConfig?.mobileMenuItemBorderWidthPx ?? 1
  );
  const mobileMenuRadiusPx = Number(headerConfig?.mobileMenuRadiusPx ?? 0);
  const mobileMenuPaddingPx = Number(headerConfig?.mobileMenuPaddingPx ?? 20);

  const mobileMenuCloseRadius =
    mobileMenuCloseRadiusPx === 999 ? "999px" : `${mobileMenuCloseRadiusPx}px`;
  const drawerBorderRadius =
    mobileMenuRadiusPx > 0 ? `${mobileMenuRadiusPx}px` : "0px";

  const overlayStyle = {
    backgroundColor: isAtelierSheet
      ? `color-mix(in srgb, ${mobileMenuOverlayColor} ${Math.round(Math.max(0, Math.min(1, mobileMenuOverlayOpacity)) * 100)}%, transparent)`
      : mobileMenuOverlayColor,
    opacity: menuOpen ? (isAtelierSheet ? 1 : mobileMenuOverlayOpacity) : 0,
    transitionDuration: `${mobileMenuAnimationDurationMs}ms`,
    backdropFilter: isAtelierSheet && menuOpen ? 'blur(4px)' : undefined,
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
    ...(isAtelierSheet ? {
      width: '100%', maxWidth: 'none', top: 'auto', bottom: 0, left: 0, right: 0,
      height: 'auto', maxHeight: 'calc(100dvh - 8px)',
      paddingLeft: 0, paddingRight: 0, backgroundColor: 'transparent',
      borderColor: 'transparent', borderWidth: 0, borderStyle: 'none',
      boxShadow: 'none', opacity: 1,
      transform: menuOpen ? 'translateY(0)' : 'translateY(105%)',
      '--atelier-ink': mobileMenuTextColor,
      '--atelier-muted': mobileMenuMutedColor,
      '--atelier-accent': mobileMenuAccentColor,
      '--atelier-line': mobileMenuItemBorderColor,
      '--atelier-surface': mobileMenuBgColor,
      '--atelier-font': mobileMenuFontFamily || 'Georgia, serif',
      '--atelier-separator-width': `${Math.max(0, Math.min(6, mobileMenuItemBorderWidthPx))}px`,
    } : {}),
  };

  const closeMenuAndNavigate = (to) => {
    setMenuOpen(false);
    navigate(to);
  };
  const selectAtelierItem = (item) => {
    setMenuOpen(false);
    if (item.isExternal) window.open(item.to, '_blank', 'noopener,noreferrer');
    else navigate(item.to);
  };
  const openSearch = (event) => {
    if (searchCloseTimerRef.current) window.clearTimeout(searchCloseTimerRef.current);
    searchTriggerRef.current = event.currentTarget;
    const target = event.currentTarget.dataset.searchPlacement;
    setSearchOpen((current) => target === searchTarget ? !current : true);
    setSearchTarget(target);
  };
  const cancelSearchClose = () => {
    if (searchCloseTimerRef.current) window.clearTimeout(searchCloseTimerRef.current);
    searchCloseTimerRef.current = null;
  };
  const scheduleSearchClose = (event) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    cancelSearchClose();
    searchCloseTimerRef.current = window.setTimeout(() => setSearchOpen(false), 120);
  };
  const closeSearch = (restoreFocus = false) => {
    cancelSearchClose();
    setSearchOpen(false);
    if (restoreFocus) searchTriggerRef.current?.focus();
  };
  const submitSearch = (term) => {
    setSearchOpen(false);
    navigate(`/buscar?q=${encodeURIComponent(term)}`);
  };
  const selectSearchProduct = (product) => {
    const key = product?.slug || product?._id;
    if (!key) return;
    setSearchOpen(false);
    navigate(`/producto/${encodeURIComponent(key)}`);
  };
  const socialLinks = [
    { label: 'Facebook', href: footerConfig.facebook, Icon: Facebook },
    { label: 'Instagram', href: footerConfig.instagram, Icon: Instagram },
  ].filter((link) => headerMenuDestination(link.href)?.isExternal);
  const whatsappHref = resolveWhatsAppHref(whatsappConfig);

  return createPortal(
    <>
      <header
        style={headerInlineStyle}
        data-shape={headerSurface.shape}
        data-glass={headerSurface.glass}
        data-tone={isDarkHeaderBackground(headerBgHex) ? 'dark' : 'light'}
        data-visible={showHeader}
        className="theme-header storefront-header-surface px-4 fixed z-50"
      >
        <div className="relative w-full h-[70px]">
          {/* Desktop */}
          <div className="hidden lg:flex w-full h-full items-center justify-between gap-4">
            <NavLink to="/" className="shrink-0 z-10">
              <HeaderBrand src={chosenLogo} alternateSrc={alternateLogo} style={logoStyle} className="object-contain" />
            </NavLink>

            <nav
              style={navStyle}
              className="header-menu flex min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto whitespace-nowrap py-3 xl:gap-6"
              aria-label="Navegación principal"
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

            <div className="header-icons flex shrink-0 items-center gap-0 text-xl">
              <div className="header-search-anchor" ref={desktopSearchAnchorRef}
                onMouseEnter={cancelSearchClose}
                onMouseLeave={scheduleSearchClose}
                onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) closeSearch(false); }}>
                <button type="button" aria-label="Buscar productos" aria-expanded={searchOpen && searchTarget === 'desktop'}
                  data-search-placement="desktop" onClick={openSearch} className="storefront-action-button"
                >
                  <HeaderActionGlyph kind="search" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                </button>
                <HeaderSearch open={searchOpen && searchTarget === 'desktop'} anchorRef={desktopSearchAnchorRef} onClose={closeSearch} onSearch={submitSearch} onSelectProduct={selectSearchProduct} onPointerEnter={cancelSearchClose} />
              </div>
              <button type="button" aria-label="Favoritos"
                onClick={() => navigate("/favoritos")}
                className="storefront-action-button"
              >
                <HeaderActionGlyph kind="favorites" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                {favorites.length > 0 && (
                  <span className="storefront-action-badge">
                    {favorites.length}
                  </span>
                )}
              </button>

              <button type="button" aria-label="Abrir carrito"
                onClick={() => setCartOpen(true)}
                className="storefront-action-button"
              >
                <HeaderActionGlyph kind="cart" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                {cart.length > 0 && (
                  <span className="storefront-action-badge">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile */}
          <div className="lg:hidden h-full">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
              <MobileMenuTrigger config={headerConfig} expanded={menuOpen}
                onClick={() => setMenuOpen(true)} aria-label="Abrir menú"
                aria-controls="storefront-mobile-menu" />
            </div>

            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-0">
              <div className="header-search-anchor" ref={mobileSearchAnchorRef}
                onMouseEnter={cancelSearchClose}
                onMouseLeave={scheduleSearchClose}
                onBlur={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) closeSearch(false); }}>
                <button type="button" aria-label="Buscar productos" aria-expanded={searchOpen && searchTarget === 'mobile'}
                  data-search-placement="mobile" onClick={openSearch} className="storefront-action-button"
                >
                  <HeaderActionGlyph kind="search" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                </button>
                <HeaderSearch open={searchOpen && searchTarget === 'mobile'} anchorRef={mobileSearchAnchorRef} onClose={closeSearch} onSearch={submitSearch} onSelectProduct={selectSearchProduct} onPointerEnter={cancelSearchClose} />
              </div>
              <button type="button" aria-label="Favoritos"
                onClick={() => navigate("/favoritos")}
                className="storefront-action-button"
              >
                <HeaderActionGlyph kind="favorites" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                {favorites.length > 0 && (
                  <span className="storefront-action-badge">
                    {favorites.length}
                  </span>
                )}
              </button>

              <button type="button" aria-label="Abrir carrito"
                onClick={() => setCartOpen(true)}
                className="storefront-action-button"
              >
                <HeaderActionGlyph kind="cart" iconSet={iconPresentation} iconImages={headerConfig.iconImages} iconOverrides={headerConfig.iconOverrides} />
                {cart.length > 0 && (
                  <span className="storefront-action-badge">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <NavLink to="/" className="pointer-events-auto flex items-center justify-center">
                <HeaderBrand src={chosenLogo} alternateSrc={alternateLogo} style={mobileLogoStyle} className="object-contain block" />
              </NavLink>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-[70] transition-all ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={overlayStyle}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        id="storefront-mobile-menu"
        className="lg:hidden fixed z-[80] shadow-2xl flex flex-col transition-all"
        aria-label="Menú móvil"
        aria-hidden={!menuOpen}
        inert={!menuOpen ? '' : undefined}
        style={asideStyle}
      >
        {isAtelierSheet ? <AtelierMobileMenu
          items={menuItems}
          storeName={storeName}
          onClose={() => setMenuOpen(false)}
          onSelect={selectAtelierItem}
          onSearch={() => { setMenuOpen(false); setSearchTarget('mobile'); setSearchOpen(true); }}
          onFavorites={() => closeMenuAndNavigate('/favoritos')}
          onCart={() => { setMenuOpen(false); setCartOpen(true); }}
          cartCount={cart.length}
          featureImage={mobileMenuFeatureImage}
          featureLink={headerConfig?.mobileMenuFeatureRef}
          socialLinks={socialLinks}
          whatsappConfig={whatsappConfig}
          closeIconColor={headerConfig?.mobileMenuCloseIconColor}
        /> : <>
        <div
          className="relative flex items-center justify-between pt-5 pb-4"
          style={{
            borderBottom: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}`,
          }}
        >
          <HeaderBrand src={chosenLogo} alternateSrc={alternateLogo} className="h-12 object-contain" />

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
            {whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 py-4 text-[17px] font-semibold transition"
              style={{ color: mobileMenuTextColor, borderBottom: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}` }}
              aria-label="Contactar por WhatsApp">
              <WhatsAppMenuIcon config={whatsappConfig} size={22} />
              <span>WhatsApp</span><ChevronRight className="ml-auto w-4 h-4" style={{ color: mobileMenuMutedColor }} />
            </a>}
          </nav>

          {socialLinks.length > 0 && <div className="pt-8 flex items-center gap-3">
            {socialLinks.map(({ label, href, Icon }) => <a key={label} href={href}
              aria-label={label} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center shadow-sm transition hover:scale-105"
              style={socialButtonStyle}><Icon className="w-5 h-5" /></a>)}
          </div>}
        </div>

        <div
          className="py-5 text-center leading-6"
          style={{
            color: mobileMenuMutedColor,
            fontSize: `${mobileMenuFooterTextSizePx}px`,
            borderTop: `${mobileMenuItemBorderWidthPx}px solid ${mobileMenuItemBorderColor}`,
          }}
        >
          {footerConfig.copyright || `© ${new Date().getFullYear()}`}
        </div>
        </>}
      </aside>

      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>,
    document.body
  );
}

export default Header;
