import { normalizeTrendingPresentation } from '../trendingPresentation';
import { trendingSceneImage } from '../trendingBackdrop';
import { isStorefrontSectionVisible } from '../../lib/storefrontSectionVisibility';
import { normalizeStoryConfig, storySectionOrder } from '../../lib/storefrontStoryConfig';
import { categoriasBackdrop } from '../../admin/appearance/sections/categorias/categoriasFanHelpers';
import { catalogImageUrl } from './catalogPresentation';

// Read the current store configuration; never copy it into a catalog draft.
export function catalogContinuityBackdrop(theme, mobile = false) {
  if (!theme) return null;
  const journey = normalizeStoryConfig(theme.global?.sectionMotion).journey;
  const continuity = categoriasBackdrop(theme, {}, { fanBackgroundMode: 'continuity' });
  // The continuous Home canvas adopts its first visible section artwork.
  const first = storySectionOrder(theme.sections).find(id => isStorefrontSectionVisible(theme, id));
  const entries = Array.isArray(theme.sections) ? theme.sections : [];
  const trending = entries.find(section => section?.id === 'tendencia');
  const presentation = normalizeTrendingPresentation(trending?.config?.presentation);
  const firstImage = first === 'tendencia' && presentation.mode === 'floatingGlass' ? trendingSceneImage(presentation, mobile) : '';
  return {
    color: theme.colors?.background || 'var(--color-bg, Canvas)',
    image: catalogImageUrl(journey.backgroundImage || firstImage || continuity.image),
  };
}
