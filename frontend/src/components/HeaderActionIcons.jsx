import goldAccount from '../assets/header-icons/gold-account.webp';
import goldFavorites from '../assets/header-icons/gold-favorites.webp';
import goldCart from '../assets/header-icons/gold-cart.webp';
import goldSearch from '../assets/header-icons/gold-search.webp';
import wineAccount from '../assets/header-icons/wine-account.webp';
import wineFavorites from '../assets/header-icons/wine-favorites.webp';
import wineCart from '../assets/header-icons/wine-cart.webp';
import wineSearch from '../assets/header-icons/wine-search.webp';
import satinAccount from '../assets/header-icons/satin-account.webp';
import satinFavorites from '../assets/header-icons/satin-favorites.webp';
import satinCart from '../assets/header-icons/satin-cart.webp';
import satinSearch from '../assets/header-icons/satin-search.webp';
import porcelainAccount from '../assets/header-icons/porcelain-account.webp';
import porcelainFavorites from '../assets/header-icons/porcelain-favorites.webp';
import porcelainCart from '../assets/header-icons/porcelain-cart.webp';
import porcelainSearch from '../assets/header-icons/porcelain-search.webp';
import './headerActionIcons.css';

const ICON_IMAGES = {
  gold: { account: goldAccount, search: goldSearch, favorites: goldFavorites, cart: goldCart },
  wine: { account: wineAccount, search: wineSearch, favorites: wineFavorites, cart: wineCart },
  satin: { account: satinAccount, search: satinSearch, favorites: satinFavorites, cart: satinCart },
  porcelain: { account: porcelainAccount, search: porcelainSearch, favorites: porcelainFavorites, cart: porcelainCart },
};

export const HEADER_ICON_SETS = [
  { value: 'gold', label: 'Oro satinado', description: 'Metal cálido de líneas limpias.' },
  { value: 'wine', label: 'Esmalte vino', description: 'Rojo profundo con filo dorado.' },
  { value: 'satin', label: 'Satén rosa', description: 'Pliegues de tela con filo dorado.' },
  { value: 'porcelain', label: 'Porcelana rosa', description: 'Esmalte suave y oro rosa.' },
];

export function resolveHeaderIcons(header = {}) {
  if (header.iconSet === 'custom') return 'custom'; // Conserva las imágenes propias guardadas antes.
  return ICON_IMAGES[header.iconSet] ? header.iconSet : 'gold';
}

export function getHeaderIconSource(iconSet, kind) {
  return (ICON_IMAGES[iconSet] || ICON_IMAGES.gold)[kind] || ICON_IMAGES.gold[kind] || goldFavorites;
}

export function HeaderActionGlyph({ kind, iconSet = 'gold', iconImages, iconOverrides }) {
  const fallback = getHeaderIconSource(iconSet, kind);
  const custom = iconSet === 'custom' ? iconImages?.[kind] : iconOverrides?.[iconSet]?.[kind];
  const src = custom || fallback;

  return <img
    className="storefront-action-glyph storefront-action-glyph--image"
    data-icon-style={iconSet}
    data-icon-kind={kind}
    data-icon-source={custom ? 'custom' : 'builtin'}
    src={src}
    width="34"
    height="34"
    alt=""
    aria-hidden="true"
    draggable="false"
    decoding="async"
    onError={(event) => {
      if (!event.currentTarget.src.endsWith(fallback)) {
        event.currentTarget.src = fallback;
        event.currentTarget.dataset.iconSource = 'builtin';
      }
    }}
  />;
}
