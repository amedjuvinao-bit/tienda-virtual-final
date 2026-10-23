// The artwork contains material and icons only. All business content stays editable.
export const INFO_GLASS_ASSETS = '/information/';
export const INFO_SERVICES = [
  { heading: 'Envíos a todo el país', text: 'Recibe tu pedido donde estés.', buttonText: 'Consultar envíos', icon: 'truck' },
  { heading: 'Asesoría personalizada', text: 'Te ayudamos a elegir lo que necesitas.', buttonText: 'Hablar con asesor', icon: 'headset' },
  { heading: 'Visítanos', text: 'Encuentra tu punto de atención más cercano.', buttonText: 'Ver ubicación', icon: 'store' },
];
const oldTexts = [
  '¡La magia de cada look! Directo a tu puerta, envíos a toda Colombia para acompañar cada etapa de tu princesa.',
  'Te asesoramos con cariño en cada detalle. Escríbenos y hagamos magia juntas.',
  '¡Conoce en persona cada detalle encantador de nuestros looks!',
];
export const INFO_GLASS_DEFAULTS = {
  eyebrow: 'CERCA DE TI', title: 'Te acompañamos\nen cada detalle',
  maxWidth: 1400, minHeight: 920, paddingX: 64, paddingY: 100,
  cardHeight: 420, cardPadding: 36, gap: 28, radius: 26, depth: 20,
  featuredId: 'card_2', featuredLift: 64, featuredWidth: 116,
  backgroundMode: 'satin', backgroundImage: '', backgroundColor: '#f6cec3',
  backgroundPositionX: 50, backgroundPositionY: 50, backgroundZoom: 100,
  material: 'artwork', materialOpacity: 90, glassOpacity: 26, blur: 12,
  cardTint: '#f6cec3', edgeColor: '#fff1e7', accentColor: '#b47745',
  titleColor: '#65172c', bodyColor: '#674841', buttonColor: '#8c1738',
  buttonTextColor: '#ffffff', sideButtonColor: '#f9d8d0',
  titleSize: 76, cardTitleSize: 30, bodySize: 17, iconSize: 148,
  titleFont: 'Georgia, serif', bodyFont: 'Inter, system-ui, sans-serif',
  showNumbers: true, iconStyle: 'relief', hoverAnimation: 'lift',
  entranceAnimation: 'fade-up', animationDuration: 550,
  mobileLayout: 'compact', mobileTitleSize: 34, mobileCardHeight: 160, mobilePadding: 18,
  mobileGap: 20, mobileIconSize: 72,
};
const numeric = {
  maxWidth: [600, 2200], minHeight: [0, 1400], paddingX: [0, 160], paddingY: [0, 200],
  cardHeight: [220, 700], cardPadding: [16, 64], gap: [12, 80], radius: [0, 60],
  depth: [0, 40], featuredLift: [0, 80], featuredWidth: [100, 140],
  backgroundPositionX: [0, 100], backgroundPositionY: [0, 100], backgroundZoom: [100, 180],
  materialOpacity: [0, 100], glassOpacity: [0, 90], blur: [0, 32],
  titleSize: [24, 100], cardTitleSize: [18, 48], bodySize: [12, 28], iconSize: [40, 160],
  animationDuration: [150, 1600], mobileTitleSize: [22, 60], mobileCardHeight: [140, 600],
  mobilePadding: [12, 48], mobileGap: [12, 64], mobileIconSize: [40, 120],
};
export function safeInfoHref(value) {
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (!s || /[\u0000-\u0020\u007f\\]/.test(s)) return '';
  if (/^#[A-Za-z][\w:-]*$/.test(s) || /^\/(?!\/)/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.username || u.password || !['https:', 'http:', 'mailto:', 'tel:'].includes(u.protocol)) return '';
    if (['mailto:', 'tel:'].includes(u.protocol) && !u.pathname) return '';
    return s;
  } catch { return ''; }
}
export function safeInfoImage(value) {
  const s = safeInfoHref(value);
  return s && (/^\/(?!\/)/.test(s) || /^https:\/\//i.test(s)) ? s : '';
}
export function normalizeInfoGlass(config = {}) {
  const input = config.glass && typeof config.glass === 'object' ? config.glass : {};
  const c = { ...INFO_GLASS_DEFAULTS, ...input };
  // Upgrade the former tall default while preserving deliberately customized dimensions.
  if (input.mobileLayout === undefined) {
    for (const [key, oldValue] of Object.entries({ mobileTitleSize: 38, mobileCardHeight: 310, mobilePadding: 22, mobileGap: 30, mobileIconSize: 90 })) {
      if (Number(input[key]) === oldValue) c[key] = INFO_GLASS_DEFAULTS[key];
    }
  }
  for (const [key, [min, max]] of Object.entries(numeric)) {
    const n = Number(c[key]);
    c[key] = Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : INFO_GLASS_DEFAULTS[key];
  }
  for (const key of ['cardTint','edgeColor','accentColor','titleColor','bodyColor','buttonColor','buttonTextColor','sideButtonColor','backgroundColor']) {
    if (!/^#[a-f\d]{6}$/i.test(c[key] || '')) c[key] = INFO_GLASS_DEFAULTS[key];
  }
  const choices = { backgroundMode: ['satin','inherit','color','image'], material: ['artwork','css'], mobileLayout: ['compact','cards'],
    iconStyle: ['relief','line'], hoverAnimation: ['none','lift','tilt','shine'],
    entranceAnimation: ['none','fade-in','fade-up','zoom-in','slide-left','slide-right'] };
  for (const [key, list] of Object.entries(choices)) if (!list.includes(c[key])) c[key] = INFO_GLASS_DEFAULTS[key];
  c.backgroundImage = safeInfoImage(c.backgroundImage);
  c.showNumbers = c.showNumbers !== false;
  for (const key of ['eyebrow','title','featuredId','titleFont','bodyFont']) c[key] = typeof c[key] === 'string' ? c[key].slice(0, 500) : INFO_GLASS_DEFAULTS[key];
  // Preserve custom content. Only replace the former built-in brand-specific copy.
  if (input.title === undefined && typeof config.titleText === 'string' && config.titleText !== '¡Te acompañamos en cada etapa de su historia!') c.title = config.titleText;
  if (input.entranceAnimation === undefined && config.entranceAnimation) c.entranceAnimation = choices.entranceAnimation.includes(config.entranceAnimation) ? config.entranceAnimation : 'none';
  return c;
}
export function infoGlassCard(card, index) {
  const base = INFO_SERVICES[index] || INFO_SERVICES[0];
  return { ...card, id: card.id || 'card_' + (index + 1),
    heading: typeof card.heading === 'string' ? card.heading : base.heading,
    text: typeof card.text === 'string' && card.text !== oldTexts[index] ? card.text : base.text,
    buttonText: typeof card.buttonText === 'string' ? card.buttonText : base.buttonText,
    detailText: typeof card.detailText === 'string' ? card.detailText : '',
    actionMode: ['details','link','whatsapp'].includes(card.actionMode) ? card.actionMode : 'details',
    href: typeof card.href === 'string' ? card.href : '', newTab: card.newTab === true,
    enabled: card.enabled !== false, buttonEnabled: card.buttonEnabled !== false,
  };
}
