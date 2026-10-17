// Siluetas de moda dibujadas a línea fina para distinguir las categorías a tamaño móvil.
const PATHS = {
  dress: [
    'M12 3.5c1.1 1.7 2.3 2.5 4 2.5s2.9-.8 4-2.5l4.1 2.2-2.6 6.2-2.6-1.4-.7 4.7c2.3 3.3 4.1 7 5.3 12.2-6.4 2.3-15.3 2.3-21.7 0 1.2-5.2 3-8.9 5.3-12.2l-.7-4.7-2.6 1.4L7.9 5.7 12 3.5Z',
    'M12.7 14.9c2.2 1 4.4 1 6.6 0M10.8 23.5c1.4 1.1 3 1.7 4.8 2.1M21.2 23.5c-1.4 1.1-3 1.7-4.8 2.1',
  ],
  jeans: [
    'M8.2 3.5h15.6l-.9 9.4-1.1 15.3-4.9.3-1.1-11.9-1.1 11.9-4.9-.3-1.1-15.3-.5-9.4Z',
    'M8.6 8.6h14.8M12 9v3.2l3.9 2.2 4.1-2.2V9M15.9 3.5v3.4M10 25.8l4.6.3M17.4 26.1l4.6-.3',
    'M10 5.7h2M20 5.7h2',
  ],
  blouse: [
    'M11 4.2 6.8 6.4 3.5 12l4.2 2.7 2.1-2.4v15.2h12.4V12.3l2.1 2.4 4.2-2.7-3.3-5.6L21 4.2l-5 3.2-5-3.2Z',
    'M11 4.2c.7 2.8 2.1 4.2 5 4.2s4.3-1.4 5-4.2M16 8.5v16.8M13.2 11.8h.1M13.2 16.1h.1M13.2 20.4h.1',
    'M9.8 24.3h12.4',
  ],
  heels: [
    'M4 21.2c3.2.8 5.9.7 8.5-.5 1.7-.8 3.1-2.2 4.4-4.7l2.7-5.6 3 1.4-.8 4c-.4 2.1.4 3.2 2.3 3.4l3.4.3c1.2.2 1.7 1 1.4 2.1-.4 1.7-2.1 2.6-4.1 2.6H8.1c-2.7 0-4.1-1-4.1-3Z',
    'M6.3 24.1l-.3 3.6h3l1.2-3.6M21.4 24.1l2.2 3.6h2.8l-1-3.6M19.6 10.4l2.5 1.5',
  ],
  shoes: [
    'M4 18.7c2.5.2 4.6-.3 6.2-1.9l3.3-3.8 2.8 2.5c1.2 1.1 2.7 1.8 4.6 2l4.7.6c2.2.3 3.3 1.6 3.3 3.8v2.2H3.5v-2.5c0-1.3.2-2.2.5-2.9Z',
    'M3.7 24.1h25.1M10.5 17.7l2.4 2M12.6 15.2l2.4 2M19.8 17.2c.1 1.7 1.2 2.8 3 3.2',
  ],
  gown: [
    'M12.8 4.5c.8 1.6 1.8 2.4 3.2 2.4s2.4-.8 3.2-2.4l2.1.9-.6 4.5-2.3 4.8c3.4 3.8 5.6 7.8 7.3 12.8-5.5 1.8-14 2-19.4 0 1.7-5 3.9-9 7.3-12.8l-2.3-4.8-.6-4.5 2.1-.9Z',
    'M12.8 4.5 11 11.2l2.6 3.1c1.6.5 3.2.5 4.8 0l2.6-3.1-1.8-6.7M12 16.8c-.3 3-1.1 5.9-2.5 8.9M20 16.8c.3 3 1.1 5.9 2.5 8.9M14.3 17.5l-1 8.6',
  ],
  skirt: [
    'M10 5.5h12l.4 5c.3 4.5 2.2 10.3 5 16.1-7.2 2.1-15.6 2.1-22.8 0 2.8-5.8 4.7-11.6 5-16.1l.4-5Z',
    'M10 10.5h12M13.1 12.7l-1.4 11.5M18.9 12.7l1.4 11.5M15.9 12.7v12.1',
  ],
  jacket: [
    'M11.5 4.2 7 6.1 4.1 14l3.7 1.9 1.9-3.2v15.1h12.6V12.7l1.9 3.2 3.7-1.9L25 6.1l-4.5-1.9L16 7.6l-4.5-3.4Z',
    'M11.5 4.2 13 11l3 2.4 3-2.4 1.5-6.8M16 13.4v14.4M11.5 18.3h2.7M17.8 18.3h2.7M11.5 24.4h2.7M17.8 24.4h2.7',
  ],
  sneakers: [
    'M4.5 17.2 9 12.5c1.7 2 3.2 3.2 5.4 4.1l3.7.5 2.8-2.4 2.1 2.1c.9 1 2.1 1.6 3.5 1.9 1.4.3 2.5 1.5 2.5 3v2.6H3.7v-2.9c0-1.6.2-2.9.8-4.2Z',
    'M4 24.3h24.6M11.4 15.4l-2.8 3M14.3 16.8l-2.1 3M17.5 17.1l-1.4 3M23 17c.1 1.6.9 2.6 2.3 3.2',
  ],
};

export const FASHION_MENU_ICON_OPTIONS = [
  { value: 'dress', label: 'Vestidos' },
  { value: 'jeans', label: 'Jeans' },
  { value: 'blouse', label: 'Blusas' },
  { value: 'heels', label: 'Zapatos de tacón' },
  { value: 'shoes', label: 'Zapatos' },
  { value: 'gown', label: 'Vestidos elegantes' },
  { value: 'skirt', label: 'Faldas' },
  { value: 'jacket', label: 'Chaquetas' },
  { value: 'sneakers', label: 'Tenis' },
];

export function isFashionMenuIcon(name) { return Object.hasOwn(PATHS, name); }

export function FashionMenuIcon({ name, size, style }) {
  return <svg className="mobile-menu-link-icon" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.35"
    strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true" data-menu-icon={name}>
    {PATHS[name].map((path, index) => <path key={index} d={path} />)}
  </svg>;
}
