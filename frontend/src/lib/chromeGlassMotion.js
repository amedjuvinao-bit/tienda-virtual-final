import { moveBannerButtonLight } from './bannerTemplates';

export const CHROME_GLASS_MOTIONS = [
  { id: 'prism', name: 'Prisma', description: 'El reflejo de vidrio original sigue el puntero.' },
  { id: 'pearl', name: 'Perla', description: 'Destello claro y discreto.' },
  { id: 'aurora', name: 'Aurora', description: 'Luz fría azul y violeta.' },
  { id: 'rose', name: 'Rosa dorado', description: 'Reflejo cálido sobre el cristal.' },
  { id: 'halo', name: 'Halo', description: 'Círculo luminoso amplio bajo el puntero.' },
  { id: 'comet', name: 'Cometa', description: 'Estela diagonal de luz sobre el vidrio.' },
  { id: 'facet', name: 'Facetas', description: 'Dos reflejos que se cruzan como cristal tallado.' },
];

export const resolveChromeGlassMotion = (value, fallback = 'prism') =>
  CHROME_GLASS_MOTIONS.some(({ id }) => id === value) ? value : fallback;
export function moveChromeGlassLight(event) {
  const surface = event.currentTarget.querySelector(':scope > .rb-chrome-hover__surface');
  if (!surface) return;
  moveBannerButtonLight({ currentTarget: surface, pointerType: event.pointerType, clientX: event.clientX, clientY: event.clientY });
  surface.style.setProperty('--rb-chrome-x', surface.style.getPropertyValue('--rb-light-x'));
  surface.style.setProperty('--rb-chrome-y', surface.style.getPropertyValue('--rb-light-y'));
}
