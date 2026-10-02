import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Monitor, Smartphone, X } from 'lucide-react';
import { isDarkHeaderBackground, normalizeHeaderMenu, resolveHeaderLogo, resolveHeaderSurface, resolveHeaderTypography } from '../../../components/headerPresentation';
import HeaderBrand from '../../../components/HeaderBrand';
import { HeaderActionGlyph, resolveHeaderIcons } from '../../../components/HeaderActionIcons';
import { headerSearchColorVariables } from '../../../components/headerSearchTheme';
import AtelierMobileMenu from '../../../components/AtelierMobileMenu';
import '../../../components/headerSearch.css';

export default function HeaderPreview({ theme, menus }) {
  const [viewport, setViewport] = useState('desktop');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [failedLogo, setFailedLogo] = useState('');
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false);
  const header = theme?.header || {};
  const links = useMemo(() => normalizeHeaderMenu(menus?.header), [menus?.header]);
  const logoLight = header.logoLight || theme?.logo?.light || '';
  const logoDark = header.logoDark || theme?.logo?.dark || '';
  const logo = resolveHeaderLogo({ ...header, logoLight, logoDark });
  const alternateLogo = logo === logoLight ? logoDark : logoLight;
  useEffect(() => setFailedLogo(''), [logo, alternateLogo]);
  const typography = resolveHeaderTypography(header, theme?.fonts?.headings || 'Georgia, serif');
  const surface = resolveHeaderSurface(header);
  const icons = resolveHeaderIcons(header);
  const mobile = viewport === 'mobile';
  const atelier = (header.mobileMenuLayout || 'atelier-sheet') === 'atelier-sheet';
  const background = header.bgColor || '#ffe3ec';
  const opacity = surface.opacity;
  const bannerImage = theme?.banner?.slides?.find((slide) => slide?.image)?.image || theme?.banner?.imageUrl || '';
  const headerColor = /^#([\da-f]{3}|[\da-f]{6})$/i.test(background)
    ? background + (background.length === 4 ? Math.round(Math.max(0, Math.min(1, opacity)) * 15).toString(16) : Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0'))
    : background;

  return <div className="appearance-header__preview" data-admin-storefront-preview="true">
    <div className="appearance-header__preview-tools">
      <div><strong>Vista previa en vivo</strong><small>Logo, tipografía, colores y tamaño antes de guardar</small></div>
      <div className="appearance-header__viewport" role="group" aria-label="Tamaño de vista previa">
        <button type="button" aria-pressed={!mobile} onClick={() => { setViewport('desktop'); setDrawerOpen(false); }}><Monitor size={15} /> Escritorio</button>
        <button type="button" aria-pressed={mobile} onClick={() => setViewport('mobile')}><Smartphone size={15} /> Móvil</button>
      </div>
    </div>
    <div className="appearance-header__scene">
      <div className="appearance-header__device" data-viewport={viewport} data-menu-open={mobile && drawerOpen && atelier ? 'atelier' : undefined} style={bannerImage ? { backgroundImage: `linear-gradient(rgba(244, 155, 201, .13), rgba(96, 20, 76, .12)), url(${JSON.stringify(bannerImage)})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <div className="appearance-header__store-header storefront-header-surface" data-shape={surface.shape} data-glass={surface.glass} data-tone={isDarkHeaderBackground(header.bgColor) ? 'dark' : 'light'} style={{ ...surface.style, ...headerSearchColorVariables(header, theme?.colors), '--header-icon-color': header.iconColor || (isDarkHeaderBackground(header.bgColor) ? '#ffffff' : '#9d4268'), '--header-icon-hover': header.iconHoverColor || '#c62d6a', '--storefront-action-size': `${Math.max(28, Math.min(40, Number(header.iconSizePx) || 34))}px`, backgroundColor: headerColor, color: header.textColor || (isDarkHeaderBackground(header.bgColor) ? '#ffffff' : '#1f1f1f'), fontFamily: typography.fontFamily, fontSize: `${header.fontSizePx || 16}px` }}>
          {mobile && <button type="button" aria-label={drawerOpen ? 'Cerrar menú de vista previa' : 'Abrir menú de vista previa'} onClick={() => setDrawerOpen(!drawerOpen)} style={{ color: header.mobileMenuTriggerIconColor || header.iconColor, backgroundColor: header.mobileMenuTriggerBgColor || '#fff' }}>{drawerOpen ? <X size={18} /> : <Menu size={18} />}</button>}
          <HeaderBrand src={logo} alternateSrc={alternateLogo} onUnavailable={setFailedLogo} style={{ maxHeight: `${mobile ? Math.min(46, Number(header.logoHeightPx) || 80) : Math.min(100, Number(header.logoHeightPx) || 80)}px` }} />
          {!mobile && <nav aria-label="Vista previa del menú" style={{ fontWeight: typography.fontWeight, fontStyle: typography.fontStyle, letterSpacing: typography.letterSpacing, textTransform: typography.textTransform }}>{links.length ? links.map((link, index) => <span key={`${link.to}-${index}`}>{link.name}</span>) : <em>Tu menú aparecerá aquí</em>}</nav>}
          <div className="appearance-header__actions">
            <div className="header-search-anchor">
              <button type="button" className="storefront-action-button" aria-label="Buscar (vista previa)" aria-expanded={searchPreviewOpen} onClick={() => setSearchPreviewOpen((open) => !open)}><HeaderActionGlyph kind="search" iconSet={icons} iconImages={header.iconImages} iconOverrides={header.iconOverrides} /></button>
              {searchPreviewOpen && <div className="header-search-popover appearance-header__search-popover"><div className="header-search-form"><span>Buscar productos...</span><span className="appearance-header__search-arrow">→</span></div></div>}
            </div>
            <button type="button" className="storefront-action-button" aria-label="Favoritos (vista previa)"><HeaderActionGlyph kind="favorites" iconSet={icons} iconImages={header.iconImages} iconOverrides={header.iconOverrides} /></button>
            <button type="button" className="storefront-action-button" aria-label="Carrito (vista previa)"><HeaderActionGlyph kind="cart" iconSet={icons} iconImages={header.iconImages} iconOverrides={header.iconOverrides} /></button>
          </div>
        </div>
        {mobile && drawerOpen && atelier && <div className="appearance-header__atelier-preview" style={{ '--atelier-ink': header.mobileMenuTextColor || '#4e1e39', '--atelier-muted': header.mobileMenuMutedColor || '#815269', '--atelier-accent': header.mobileMenuAccentColor || '#ac7950', '--atelier-line': header.mobileMenuItemBorderColor || '#d2a997', '--atelier-surface': header.mobileMenuBgColor || '#fff4f3', '--atelier-font': header.mobileMenuFontFamily || 'Georgia, serif', '--atelier-separator-width': `${Math.max(0, Math.min(6, Number(header.mobileMenuItemBorderWidthPx ?? 1)))}px` }}>
          <AtelierMobileMenu items={links} logo={logo} alternateLogo={alternateLogo} featureImage={bannerImage} preview
            onClose={() => setDrawerOpen(false)} onSelect={() => setDrawerOpen(false)}
            onSearch={() => { setDrawerOpen(false); setSearchPreviewOpen(true); }}
            onFavorites={() => setDrawerOpen(false)} onCart={() => setDrawerOpen(false)} />
        </div>}
        {mobile && drawerOpen && !atelier && <div className="appearance-header__drawer" style={{ backgroundColor: header.mobileMenuBgColor || '#fffdfd', color: header.mobileMenuTextColor || '#1f1f1f', fontFamily: header.mobileMenuFontFamily || typography.fontFamily, fontWeight: typography.fontWeight, fontStyle: typography.fontStyle, letterSpacing: typography.letterSpacing, textTransform: typography.textTransform }}>
          {links.length ? links.map((link, index) => <div key={`${link.to}-${index}`}>{link.name}</div>) : <p>Añade enlaces en la pestaña Menú.</p>}
        </div>}
        <div className="appearance-header__hero"><div className="appearance-header__hero-label">Tu tienda</div><span>El encabezado se verá aquí</span></div>
      </div>
    </div>
    <p className="appearance-header__preview-note">{failedLogo ? 'Una versión del logo no carga. Revisa las imágenes en Identidad → Logo y vuelve a subir la que falla.' : !logo ? 'No hay un logo cargado. Se muestra el nombre de la tienda hasta que subas uno en Identidad → Logo.' : 'Simulación del encabezado. Guarda para aplicar estos cambios a la tienda.'}</p>
  </div>;
}
