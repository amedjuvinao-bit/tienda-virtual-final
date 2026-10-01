import { CircleUserRound, Heart, ShoppingBag, ShoppingBasket, ShoppingCart, User, UserRound } from 'lucide-react';
import './headerActionIcons.css';

export const HEADER_ICON_SETS = [
  { value: 'classic', label: 'Clásicos', description: 'Contornos familiares y ligeros.' },
  { value: 'boutique', label: 'Boutique', description: 'Bolso y trazos delicados.' },
  { value: 'atelier', label: 'Atelier', description: 'Símbolos llenos y con carácter.' },
];

export const HEADER_ICON_FINISHES = [
  { value: 'minimal', label: 'Limpio', description: 'Sin contenedor.' },
  { value: 'glass', label: 'Cristal', description: 'Luz y profundidad.' },
  { value: 'jewel', label: 'Joya', description: 'Relieve y brillo intenso.' },
];

export function resolveHeaderIcons(header = {}) {
  return {
    set: HEADER_ICON_SETS.some(({ value }) => value === header.iconSet) ? header.iconSet : 'boutique',
    finish: HEADER_ICON_FINISHES.some(({ value }) => value === header.iconFinish) ? header.iconFinish : 'glass',
  };
}

const GLYPHS = {
  classic: { account: User, favorites: Heart, cart: ShoppingCart },
  boutique: { account: UserRound, favorites: Heart, cart: ShoppingBag },
  atelier: { account: CircleUserRound, favorites: Heart, cart: ShoppingBasket },
};

export function HeaderActionGlyph({ kind, iconSet = 'boutique' }) {
  const resolvedSet = GLYPHS[iconSet] ? iconSet : 'boutique';
  const Icon = GLYPHS[resolvedSet][kind] || Heart;
  return <Icon className="storefront-action-glyph" size={21} strokeWidth={resolvedSet === 'classic' ? 1.8 : 2.1}
    fill={resolvedSet === 'atelier' && kind === 'favorites' ? 'currentColor' : 'none'} aria-hidden="true" />;
}
