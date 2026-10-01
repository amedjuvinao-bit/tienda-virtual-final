import roseAccount from '../assets/header-icons/rose-account.webp';
import roseFavorites from '../assets/header-icons/rose-favorites.webp';
import roseCart from '../assets/header-icons/rose-cart.webp';
import noirAccount from '../assets/header-icons/noir-account.webp';
import noirFavorites from '../assets/header-icons/noir-favorites.webp';
import noirCart from '../assets/header-icons/noir-cart.webp';
import './headerActionIcons.css';

const ICON_IMAGES = {
  rose: { account: roseAccount, favorites: roseFavorites, cart: roseCart },
  noir: { account: noirAccount, favorites: noirFavorites, cart: noirCart },
};

export const HEADER_ICON_SETS = [
  { value: 'rose', label: 'Cristal rosa', description: 'Cristal, perla y oro rosa.' },
  { value: 'noir', label: 'Noir dorado', description: 'Esmalte negro y oro pulido.' },
  { value: 'custom', label: 'Mis imágenes', description: 'Carga tus tres iconos.' },
];

export function resolveHeaderIcons(header = {}) {
  // Configuraciones antiguas siguen funcionando y muestran el nuevo diseño.
  return HEADER_ICON_SETS.some(({ value }) => value === header.iconSet) ? header.iconSet : 'rose';
}

export function HeaderActionGlyph({ kind, iconSet = 'rose', iconImages }) {
  const fallback = ICON_IMAGES.rose[kind] || roseFavorites;
  const src = iconSet === 'custom' ? (iconImages?.[kind] || fallback) : (ICON_IMAGES[iconSet]?.[kind] || fallback);

  return <img
    className="storefront-action-glyph storefront-action-glyph--image"
    data-icon-style={iconSet}
    src={src}
    width="40"
    height="40"
    alt=""
    aria-hidden="true"
    draggable="false"
    decoding="async"
    onError={(event) => {
      if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
    }}
  />;
}
