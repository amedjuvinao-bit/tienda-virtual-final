import { CircleUserRound, Heart, ShoppingBag, ShoppingBasket, ShoppingCart, User, UserRound } from 'lucide-react';
import './headerActionIcons.css';

export const HEADER_ICON_SETS = [
  { value: 'classic', label: 'Clásico', description: 'Perfil, corazón y carrito.' },
  { value: 'boutique', label: 'Boutique', description: 'Curvas ligeras y bolso.' },
  { value: 'atelier', label: 'Atelier', description: 'Perfil circular y cesta.' },
  { value: 'silk', label: 'Seda', description: 'Línea especialmente fina.' },
  { value: 'editorial', label: 'Editorial', description: 'Geometría sobria y abierta.' },
  { value: 'essence', label: 'Esencia', description: 'Formas suaves y pequeñas.' },
];

export function resolveHeaderIcons(header = {}) {
  return HEADER_ICON_SETS.some(({ value }) => value === header.iconSet) ? header.iconSet : 'boutique';
}

const GLYPHS = {
  classic: { account: User, favorites: Heart, cart: ShoppingCart, width: 1.65, size: 19 },
  boutique: { account: UserRound, favorites: Heart, cart: ShoppingBag, width: 1.45, size: 19 },
  atelier: { account: CircleUserRound, favorites: Heart, cart: ShoppingBasket, width: 1.45, size: 19 },
  silk: { account: UserRound, favorites: Heart, cart: ShoppingBag, width: 1.2, size: 20 },
  editorial: { account: User, favorites: Heart, cart: ShoppingBasket, width: 1.3, size: 20 },
  essence: { account: UserRound, favorites: Heart, cart: ShoppingCart, width: 1.25, size: 18 },
};

export function HeaderActionGlyph({ kind, iconSet = 'boutique' }) {
  const model = GLYPHS[iconSet] || GLYPHS.boutique;
  const Icon = model[kind] || Heart;
  return <Icon className="storefront-action-glyph" size={model.size} strokeWidth={model.width} fill="none" aria-hidden="true" />;
}
