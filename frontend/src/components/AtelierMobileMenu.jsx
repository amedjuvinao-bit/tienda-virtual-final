import { ChevronRight, Heart, Search, ShoppingBag, X } from 'lucide-react';
import { MobileMenuLinkIcon } from './mobileMenuIcons';
import WhatsAppMenuIcon from './WhatsAppMenuIcon';
import { resolveWhatsAppHref } from './whatsappLink';
import './atelierMobileMenu.css';

export default function AtelierMobileMenu({
  items = [], storeName = 'Rosa Boutique', onClose, onSelect, onSearch, onFavorites, onCart,
  cartCount = 0, featureImage = '', featureLink = '', socialLinks = [], whatsappConfig = null, closeIconColor = '', preview = false,
}) {
  const featured = items.find((item) => item.to === featureLink && !item.isExternal)
    || items.find((item) => item.to !== '/' && !item.isExternal) || items[0];
  const whatsappHref = resolveWhatsAppHref(whatsappConfig);

  return <div className="atelier-menu" data-preview={preview ? 'true' : undefined}>
    <span className="atelier-menu__handle" aria-hidden="true" />
    <div className="atelier-menu__top">
      <span className="atelier-menu__brand">{storeName}</span>
      <button type="button" className="atelier-menu__close" style={closeIconColor ? { color: closeIconColor } : undefined}
        onClick={onClose} aria-label="Cerrar menú"><X size={21} strokeWidth={1.4} /></button>
    </div>

    <nav className="atelier-menu__links" aria-label={preview ? 'Vista previa del menú móvil' : 'Navegación móvil'}>
      {items.length ? items.map((item, index) => {
        const content = <><MobileMenuLinkIcon name={item.icon} color={item.iconColor} /><span>{item.name}</span><ChevronRight className="atelier-menu__chevron" size={16} strokeWidth={1.5} aria-hidden="true" /></>;
        return item.isExternal
          ? <a key={`${item.to}-${index}`} className="atelier-menu__link" href={preview ? undefined : item.to} target={preview ? undefined : '_blank'} rel={preview ? undefined : 'noopener noreferrer'} onClick={preview ? (event) => event.preventDefault() : onClose}>{content}</a>
          : <button key={`${item.to}-${index}`} type="button" className="atelier-menu__link" onClick={() => onSelect?.(item)}>{content}</button>;
      }) : <p className="atelier-menu__empty">Añade enlaces en Apariencia → Enlaces.</p>}
    </nav>

    {featured && <button type="button" className="atelier-menu__feature"
      style={featureImage ? { backgroundImage: `linear-gradient(90deg, rgba(58,18,39,.88), rgba(58,18,39,.36)), url(${JSON.stringify(featureImage)})` } : undefined}
      onClick={() => onSelect?.(featured)}>
      <span className="atelier-menu__feature-eyebrow">DESTACADO</span>
      <strong>{featured.name}</strong>
      <span className="atelier-menu__feature-action">Descubrir <ChevronRight size={15} aria-hidden="true" /></span>
    </button>}

    <div className="atelier-menu__bottom" data-has-whatsapp={whatsappHref ? 'true' : undefined}>
      <button type="button" onClick={onSearch} aria-label="Buscar desde el menú"><Search size={22} strokeWidth={1.6} /><span>Buscar</span></button>
      <button type="button" onClick={onFavorites} aria-label="Favoritos desde el menú"><Heart size={22} strokeWidth={1.6} /><span>Favoritos</span></button>
      <button type="button" onClick={onCart} aria-label="Carrito desde el menú" className="atelier-menu__cart"><ShoppingBag size={22} strokeWidth={1.6} /><span>Carrito</span>{cartCount > 0 && <small>{cartCount}</small>}</button>
      {whatsappHref && <a href={preview ? undefined : whatsappHref} target={preview ? undefined : '_blank'} rel={preview ? undefined : 'noopener noreferrer'}
        onClick={preview ? (event) => event.preventDefault() : onClose} aria-label="Contactar por WhatsApp">
        <WhatsAppMenuIcon config={whatsappConfig} size={34} slotSize={25} /><span>WhatsApp</span>
      </a>}
    </div>
    {socialLinks.length > 0 && <div className="atelier-menu__social">{socialLinks.map(({ label, href, Icon }) => <a key={label} href={preview ? undefined : href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={preview ? (event) => event.preventDefault() : undefined}><Icon size={15} strokeWidth={1.5} /></a>)}</div>}
  </div>;
}
