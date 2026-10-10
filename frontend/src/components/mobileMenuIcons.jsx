import { BookOpen, Coffee, Gift, Grid2X2, Heart, House, Leaf, Package, ShoppingBag, Smartphone, Sparkles, Tag, Wrench } from 'lucide-react';
import { FASHION_MENU_ICON_OPTIONS, FashionMenuIcon, isFashionMenuIcon } from './fashionMenuIcons';

const ICONS = {
  grid: Grid2X2,
  home: House,
  new: Sparkles,
  collection: Package,
  offer: Tag,
  gift: Gift,
  shop: ShoppingBag,
  favorites: Heart,
  books: BookOpen,
  food: Coffee,
  technology: Smartphone,
  services: Wrench,
  nature: Leaf,
};

export const MOBILE_MENU_ICON_OPTIONS = [
  { value: 'grid', label: 'Categoría general' },
  { value: 'home', label: 'Inicio' },
  { value: 'new', label: 'Novedades' },
  { value: 'collection', label: 'Colección' },
  { value: 'offer', label: 'Oferta' },
  { value: 'gift', label: 'Regalos' },
  { value: 'shop', label: 'Tienda' },
  { value: 'favorites', label: 'Favoritos' },
  { value: 'books', label: 'Libros' },
  { value: 'food', label: 'Alimentos' },
  { value: 'technology', label: 'Tecnología' },
  { value: 'services', label: 'Servicios' },
  { value: 'nature', label: 'Naturaleza' },
  ...FASHION_MENU_ICON_OPTIONS.map((option) => ({ ...option, group: 'fashion' })),
];

export function normalizeMobileMenuIcon(value) {
  return Object.hasOwn(ICONS, value) || isFashionMenuIcon(value) ? value : 'grid';
}

export function normalizeMobileMenuIconColor(value) {
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value || '') ? value : '';
}

export function MobileMenuLinkIcon({ name, size = 22, color = '' }) {
  const normalized = normalizeMobileMenuIcon(name);
  const style = normalizeMobileMenuIconColor(color) ? { color } : undefined;
  if (isFashionMenuIcon(normalized)) return <FashionMenuIcon name={normalized} size={size} style={style} />;
  const Icon = ICONS[normalized];
  return <Icon className="mobile-menu-link-icon" size={size} strokeWidth={1.45} style={style} aria-hidden="true" data-menu-icon={normalized} />;
}
