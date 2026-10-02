import { BookOpen, Coffee, Gift, Grid2X2, Heart, House, Leaf, Package, ShoppingBag, Smartphone, Sparkles, Tag, Wrench } from 'lucide-react';

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
];

export function normalizeMobileMenuIcon(value) {
  return Object.hasOwn(ICONS, value) ? value : 'grid';
}

export function MobileMenuLinkIcon({ name, size = 22 }) {
  const Icon = ICONS[normalizeMobileMenuIcon(name)];
  return <Icon size={size} strokeWidth={1.45} aria-hidden="true" data-menu-icon={normalizeMobileMenuIcon(name)} />;
}
