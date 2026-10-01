import { Heart, ShoppingBag, ShoppingCart, User, UserRound } from 'lucide-react';
import './headerActionIcons.css';

export const HEADER_ICON_SETS = [
  { value: 'classic', label: 'Clásico', description: 'Línea abierta y carrito.' },
  { value: 'boutique', label: 'Boutique', description: 'Curvas finas y bolso.' },
  { value: 'atelier', label: 'Silueta', description: 'Figuras sólidas pequeñas.' },
  { value: 'silk', label: 'Destello', description: 'Trazo fino con una luz.' },
  { value: 'editorial', label: 'Geométrico', description: 'Ángulos de alta costura.' },
  { value: 'essence', label: 'Línea continua', description: 'Formas suaves sin marco.' },
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
    account: <><circle cx="10" cy="8" r="2.8" /><path d="M4.5 19c0-3.1 2.1-5 5.5-5s5.5 1.9 5.5 5" /><path d="m18.5 3 .7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7L18.5 3Z" /></>,
    favorites: <><path d="M11 20 4 13C-1 8 5 2 10 6l1 1 1-1c5-4 11 2 6 7l-7 7Z" /><path d="m19 2 .5 1.5L21 4l-1.5.5L19 6l-.5-1.5L17 4l1.5-.5L19 2Z" /></>,
    cart: <><path d="M4 9h14l-1 11H5L4 9ZM7.5 10V7.5a3.5 3.5 0 0 1 7 0V10" /><path d="m19.5 3 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" /></>,
  },
  editorial: {
    account: <><path d="m12 3 3.6 3.6L12 10.2 8.4 6.6 12 3Z" /><path d="m3.5 20 1.3-4.8 7.2-3.1 7.2 3.1 1.3 4.8H3.5Z" /></>,
    favorites: <path d="m12 20-9-9V6l4-3 5 4 5-4 4 3v5l-9 9Z" />,
    cart: <><path d="M6 8h12l2 12H4L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2M4.8 13h14.4" /></>,
  },
  essence: {
    account: <><circle cx="12" cy="7.5" r="3" /><path d="M4 20c0-4 3-6.5 8-6.5s8 2.5 8 6.5" /></>,
    favorites: <path d="M12 20c-3-3-9-8-9-12a4 4 0 0 1 8-1l1 1 1-1a4 4 0 0 1 8 1c0 4-6 9-9 12Z" />,
    cart: <><path d="M6 10c0 7-1 10 6 10s6-3 6-10M6 10h12" /><path d="M9 12V8a3 3 0 0 1 6 0v4" /></>,
  },
};

export function HeaderActionGlyph({ kind, iconSet = 'boutique' }) {
  const outline = OUTLINE_GLYPHS[iconSet];
  if (outline) {
    const Icon = outline[kind] || Heart;
    return <Icon className="storefront-action-glyph" data-icon-style={iconSet} size={20} strokeWidth={outline.width} fill="none" aria-hidden="true" />;
  }
  const style = CUSTOM_GLYPHS[iconSet] ? iconSet : 'essence';
  return <svg className="storefront-action-glyph" data-icon-style={style} width="20" height="20" viewBox="0 0 24 24"
    fill={style === 'atelier' ? 'currentColor' : 'none'} stroke={style === 'atelier' ? 'none' : 'currentColor'}
    strokeWidth={style === 'silk' ? '1.25' : '1.5'} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {CUSTOM_GLYPHS[style][kind] || CUSTOM_GLYPHS[style].favorites}
  </svg>;
}
