import { useId } from 'react';
import { Heart, ShoppingBag, ShoppingCart, User, UserRound } from 'lucide-react';
import './headerActionIcons.css';

export const HEADER_ICON_SETS = [
  { value: 'classic', label: 'Clásico', description: 'Línea abierta y carrito.' },
  { value: 'boutique', label: 'Boutique', description: 'Curvas finas y bolso.' },
  { value: 'atelier', label: 'Silueta', description: 'Figuras sólidas con brillo.' },
  { value: 'silk', label: 'Couture', description: 'Trazo dorado y destello.' },
  { value: 'editorial', label: 'Facetas', description: 'Joyas de líneas angulares.' },
  { value: 'essence', label: 'Caligrafía', description: 'Curvas y acentos de tinta.' },
];

export function resolveHeaderIcons(header = {}) {
  return HEADER_ICON_SETS.some(({ value }) => value === header.iconSet) ? header.iconSet : 'boutique';
}

const OUTLINE_GLYPHS = {
  classic: { account: User, favorites: Heart, cart: ShoppingCart, width: 1.65 },
  boutique: { account: UserRound, favorites: Heart, cart: ShoppingBag, width: 1.3 },
};

const CUSTOM_GLYPHS = {
  atelier: {
    account: <><circle cx="12" cy="7" r="3.2" /><path d="M4.5 20c.3-4 3.1-6.2 7.5-6.2s7.2 2.2 7.5 6.2c-4.8 1.4-10.2 1.4-15 0Z" /></>,
    favorites: <path d="M20.7 4.9a5 5 0 0 0-7.1 0L12 6.5l-1.6-1.6a5 5 0 0 0-7.1 7.1L12 20.7l8.7-8.7a5 5 0 0 0 0-7.1Z" />,
    cart: <><path d="M4.5 9.5h15l-1.2 11H5.7l-1.2-11Z" /><path d="M8.4 9.5v-2a3.6 3.6 0 0 1 7.2 0v2" fill="none" stroke="currentColor" strokeWidth="1.7" /></>,
  },
  silk: {
    account: <><circle cx="9.5" cy="8" r="3" /><path d="M3.5 20c0-3.4 2.3-5.5 6-5.5S16 16.6 16 20" /><path d="m18.5 2 1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1L18.5 2Z" className="storefront-action-accent" /></>,
    favorites: <><path d="M11 21 3.8 13.8C-1.3 8.7 4.4 2.3 9.8 6l1.2 1.2L12.2 6c5.4-3.7 11.1 2.7 6 7.8L11 21Z" /><path d="m19.2 1.7.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Z" className="storefront-action-accent" /></>,
    cart: <><path d="M3.5 9.5h14.2l-1.2 11H4.7l-1.2-11ZM7 10V7a3.5 3.5 0 0 1 7 0v3" /><path d="m19.4 2 .9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9.9-2.5Z" className="storefront-action-accent" /></>,
  },
  editorial: {
    account: <><path d="m12 2.5 4 4L12 10.5l-4-4 4-4ZM3 20.5l1.5-5.3 7.5-3.2 7.5 3.2 1.5 5.3H3Z" /><path d="m12 2.5 4 4-4 4Z M12 12l7.5 3.2 1.5 5.3h-9Z" className="storefront-action-facet" /></>,
    favorites: <><path d="m12 21-9.5-9.5V6l4.5-3 5 4.5L17 3l4.5 3v5.5L12 21Z" /><path d="M12 7.5 17 3l4.5 3v5.5L12 21Z" className="storefront-action-facet" /><path d="M2.5 11.5h19M12 7.5V21" /></>,
    cart: <><path d="M6 8h12l2.3 12.5H3.7L6 8ZM9 8V6a3 3 0 0 1 6 0v2" /><path d="M12 8h6l2.3 12.5H12Z" className="storefront-action-facet" /><path d="M4.8 13h14.4M12 13v7.5" /></>,
  },
  essence: {
    account: <><circle cx="12" cy="7.2" r="3.2" /><path d="M3 20.5c1.2-5 4.1-7 9-7s7.8 2 9 7" /><path d="M8.4 18.9c1.8-1.4 5.4-1.4 7.2 0" className="storefront-action-accent" /></>,
    favorites: <><path d="M12 20.7C8 17.1 2.7 12.3 2.7 8.2c0-4.6 5.5-6.2 9.3-1.1 3.8-5.1 9.3-3.5 9.3 1.1 0 4.1-5.3 8.9-9.3 12.5Z" /><path d="M7.5 8.2c.6-1.2 1.5-1.5 2.4-.9" className="storefront-action-accent" /></>,
    cart: <><path d="M4.6 10.2c.2 7.2.4 10.2 7.4 10.2s7.2-3 7.4-10.2H4.6ZM8 11V7a4 4 0 0 1 8 0v4" /><path d="M8.8 15.8c1.4 1.4 5 1.4 6.4 0" className="storefront-action-accent" /></>,
  },
};

export function HeaderActionGlyph({ kind, iconSet = 'boutique' }) {
  const id = useId().replace(/:/g, '');
  const outline = OUTLINE_GLYPHS[iconSet];
  if (outline) {
    const Icon = outline[kind] || Heart;
    return <Icon className="storefront-action-glyph" data-icon-style={iconSet} size={26} strokeWidth={outline.width} fill="none" aria-hidden="true" />;
  }
  const style = CUSTOM_GLYPHS[iconSet] ? iconSet : 'essence';
  return <svg className="storefront-action-glyph" data-icon-style={style} width="26" height="26" viewBox="0 0 24 24"
    fill={style === 'atelier' ? `url(#${id})` : 'none'} stroke={style === 'atelier' ? 'none' : 'currentColor'}
    strokeWidth={style === 'silk' ? '1.5' : style === 'essence' ? '1.85' : '1.6'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {style === 'atelier' && <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="currentColor" /><stop offset="1" stopColor="var(--header-icon-highlight, #d6a55f)" /></linearGradient></defs>}
    {CUSTOM_GLYPHS[style][kind] || CUSTOM_GLYPHS[style].favorites}
  </svg>;
}
