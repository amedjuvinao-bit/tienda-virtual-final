import React, { useMemo, useState } from 'react';
import { Heart, Menu, Monitor, ShoppingCart, Smartphone, X } from 'lucide-react';
import { normalizeHeaderMenu, resolveHeaderLogo } from '../../../components/headerPresentation';

export default function HeaderPreview({ theme, menus }) {
  const [viewport, setViewport] = useState('desktop');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const header = theme?.header || {};
  const links = useMemo(() => normalizeHeaderMenu(menus?.header), [menus?.header]);
  const logo = resolveHeaderLogo(header);
  const mobile = viewport === 'mobile';
  const background = header.bgColor || '#ffe3ec';
  const opacity = Number(header.bgOpacity ?? 1);
  const headerColor = /^#([\da-f]{3}|[\da-f]{6})$/i.test(background)
    ? background + (background.length === 4 ? Math.round(Math.max(0, Math.min(1, opacity)) * 15).toString(16) : Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0'))
    : background;

  return <div className="appearance-header__preview" data-admin-storefront-preview="true">
    <div className="appearance-header__preview-tools">
      <div><strong>Vista previa en vivo</strong><small>Logo, colores, menú y tamaño antes de guardar</small></div>
      <div className="appearance-header__viewport" role="group" aria-label="Tamaño de vista previa">
        <button type="button" aria-pressed={!mobile} onClick={() => { setViewport('desktop'); setDrawerOpen(false); }}><Monitor size={15} /> Escritorio</button>
        <button type="button" aria-pressed={mobile} onClick={() => setViewport('mobile')}><Smartphone size={15} /> Móvil</button>
      </div>
    </div>
    <div className="appearance-header__scene">
      <div className="appearance-header__device" data-viewport={viewport}>
        <div className="appearance-header__store-header" style={{ backgroundColor: headerColor, color: header.textColor || '#1f1f1f', fontFamily: header.fontFamily || 'var(--header-font-family)', fontSize: `${header.fontSizePx || 16}px` }}>
          {mobile && <button type="button" aria-label={drawerOpen ? 'Cerrar menú de vista previa' : 'Abrir menú de vista previa'} onClick={() => setDrawerOpen(!drawerOpen)} style={{ color: header.mobileMenuTriggerIconColor || header.iconColor, backgroundColor: header.mobileMenuTriggerBgColor || '#fff' }}>{drawerOpen ? <X size={18} /> : <Menu size={18} />}</button>}
          <img src={logo} alt="Logo del encabezado" style={{ maxHeight: `${mobile ? Math.min(46, Number(header.logoHeightPx) || 80) : Math.min(100, Number(header.logoHeightPx) || 80)}px` }} />
          {!mobile && <nav aria-label="Vista previa del menú">{links.length ? links.map((link, index) => <span key={`${link.to}-${index}`}>{link.name}</span>) : <em>Tu menú aparecerá aquí</em>}</nav>}
          <div className="appearance-header__actions" style={{ color: header.iconColor || 'inherit' }}><Heart size={18} /><ShoppingCart size={18} /></div>
        </div>
        {mobile && drawerOpen && <div className="appearance-header__drawer" style={{ backgroundColor: header.mobileMenuBgColor || '#fffdfd', color: header.mobileMenuTextColor || '#1f1f1f' }}>
          {links.length ? links.map((link, index) => <div key={`${link.to}-${index}`}>{link.name}</div>) : <p>Añade enlaces en la pestaña Menú.</p>}
        </div>}
        <div className="appearance-header__hero"><div className="appearance-header__hero-label">Tu tienda</div><span>El encabezado se verá aquí</span></div>
      </div>
    </div>
    <p className="appearance-header__preview-note">Simulación del encabezado. Guarda para aplicar estos cambios a la tienda.</p>
  </div>;
}
