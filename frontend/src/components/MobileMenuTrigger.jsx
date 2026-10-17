import './mobileMenuTrigger.css';

export const MOBILE_TRIGGER_ICONS = [
  { value: 'classic', label: 'Esencial', detail: 'Tres trazos equilibrados' },
  { value: 'editorial', label: 'Editorial', detail: 'Dos trazos desplazados' },
  { value: 'cascade', label: 'Cascada', detail: 'Tres trazos escalonados' },
  { value: 'dots', label: 'Constelación', detail: 'Seis puntos delicados' },
];

export const MOBILE_TRIGGER_MOTIONS = [
  { value: 'none', label: 'Quieto', detail: 'Sin movimiento' },
  { value: 'glide', label: 'Cintas', detail: 'Los trazos se cruzan y se recogen' },
  { value: 'glass', label: 'Prisma', detail: 'Un barrido de luz revela el cierre' },
  { value: 'halo', label: 'Órbita', detail: 'El símbolo se abre con un eco circular' },
  { value: 'morph', label: 'Metamorfosis', detail: 'Los trazos giran y forman el cierre' },
];

export function resolveMobileTriggerIcon(value) {
  if (MOBILE_TRIGGER_ICONS.some((option) => option.value === value)) return value;
  return { rounded: 'classic', thin: 'editorial', bold: 'cascade' }[value] || 'classic';
}

export function resolveMobileTriggerMotion(value) {
  if (MOBILE_TRIGGER_MOTIONS.some((option) => option.value === value)) return value;
  return { soft: 'glide', pop: 'halo', rotate: 'morph', pulse: 'halo' }[value] || 'none';
}

const between = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export default function MobileMenuTrigger({ config = {}, expanded = false, onClick, decorative = false, className = '', ...props }) {
  const icon = resolveMobileTriggerIcon(config.mobileMenuTriggerIcon);
  const motion = resolveMobileTriggerMotion(config.mobileMenuTriggerAnimation || 'glide');
  const size = between(config.mobileMenuTriggerSizePx, 32, 80, 40);
  const iconSize = between(config.mobileMenuTriggerIconSizePx, 14, 36, 20);
  const borderWidth = between(config.mobileMenuTriggerBorderWidthPx, 0, 8, 1);
  const radius = between(config.mobileMenuTriggerRadiusPx, 0, 999, 999);
  const backgroundOpacity = between(config.mobileMenuTriggerBgOpacity, 0, 100, 30);
  const duration = between(config.mobileMenuTriggerMotionDurationMs, 180, 700, 440);
  const Element = decorative ? 'span' : 'button';
  const elementProps = decorative ? { 'aria-hidden': true } : { type: 'button', onClick, 'aria-expanded': expanded, ...props };

  return <Element {...elementProps} className={`storefront-mobile-trigger ${className}`.trim()}
    data-icon={icon} data-motion={motion} data-expanded={expanded ? 'true' : 'false'} data-transparent={backgroundOpacity === 0 ? 'true' : undefined}
    style={{
      width: size, height: size, borderRadius: radius,
      borderWidth, borderColor: config.mobileMenuTriggerBorderColor || '#d3a7b7',
      backgroundColor: `color-mix(in srgb, ${config.mobileMenuTriggerBgColor || '#ffffff'} ${backgroundOpacity}%, transparent)`,
      color: config.mobileMenuTriggerIconColor || '#8d5c6b',
      '--mobile-trigger-icon-size': `${iconSize}px`,
      '--mobile-trigger-duration': `${duration}ms`,
    }}>
    <span className="storefront-mobile-trigger__glyph" aria-hidden="true">
      {Array.from({ length: icon === 'dots' ? 6 : 3 }, (_, index) => <i key={index} />)}
    </span>
    <span className="storefront-mobile-trigger__close" aria-hidden="true"><i /><i /></span>
  </Element>;
}
