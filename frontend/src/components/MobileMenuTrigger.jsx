import './mobileMenuTrigger.css';

export const MOBILE_TRIGGER_ICONS = [
  { value: 'classic', label: 'Esencial', detail: 'Tres trazos equilibrados' },
  { value: 'editorial', label: 'Editorial', detail: 'Dos trazos desplazados' },
  { value: 'cascade', label: 'Cascada', detail: 'Tres trazos escalonados' },
  { value: 'dots', label: 'Constelación', detail: 'Seis puntos delicados' },
];

export const MOBILE_TRIGGER_MOTIONS = [
  { value: 'none', label: 'Quieto', detail: 'Sin movimiento' },
  { value: 'glide', label: 'Trazo fluido', detail: 'Los trazos se deslizan al pasar' },
  { value: 'glass', label: 'Destello de cristal', detail: 'Un reflejo cruza el botón' },
  { value: 'halo', label: 'Halo suave', detail: 'Un aro aparece alrededor' },
  { value: 'morph', label: 'Apertura fluida', detail: 'El símbolo se transforma al abrir' },
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
  const Element = decorative ? 'span' : 'button';
  const elementProps = decorative ? { 'aria-hidden': true } : { type: 'button', onClick, 'aria-expanded': expanded, ...props };

  return <Element {...elementProps} className={`storefront-mobile-trigger ${className}`.trim()}
    data-icon={icon} data-motion={motion} data-expanded={expanded ? 'true' : 'false'}
    style={{
      width: size, height: size, borderRadius: radius,
      borderWidth, borderColor: config.mobileMenuTriggerBorderColor || '#d3a7b7',
      backgroundColor: config.mobileMenuTriggerBgColor || '#ffffff',
      color: config.mobileMenuTriggerIconColor || '#8d5c6b',
      '--mobile-trigger-icon-size': `${iconSize}px`,
    }}>
    <span className="storefront-mobile-trigger__glyph" aria-hidden="true">
      {Array.from({ length: icon === 'dots' ? 6 : 3 }, (_, index) => <i key={index} />)}
    </span>
    <span className="storefront-mobile-trigger__close" aria-hidden="true"><i /><i /></span>
  </Element>;
}
