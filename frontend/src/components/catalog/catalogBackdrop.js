import { normalizeTrendingPresentation } from '../trendingPresentation';
import { trendingSceneImage } from '../trendingBackdrop';
import { isStorefrontSectionVisible } from '../../lib/storefrontSectionVisibility';
import {
  normalizeStoryConfig,
  storySectionOrder,
} from '../../lib/storefrontStoryConfig';
import {
  categoriasBackdrop,
  normalizeCategoriasFanStyle,
} from '../../admin/appearance/sections/categorias/categoriasFanHelpers';
import { normalizeLookSection } from '../../admin/appearance/sections/look/lookSectionHelpers';
import {
  normalizeComplementosSection,
  resolveComplementosBackdrop,
} from '../../admin/appearance/sections/complementos/complementosSectionHelpers';
import { normalizeJournal } from '../../admin/appearance/sections/instagram/instagramJournalHelpers';
import { normalizeStage } from '../../admin/appearance/sections/tiktok/tiktokStageHelpers';
import {
  normalizeInfoGlass,
  INFO_GLASS_ASSETS,
} from '../../admin/appearance/sections/info/infoGlassHelpers';
import { catalogImageUrl } from './catalogPresentation';

function sectionImage(theme, id, section, mobile) {
  const config = section?.config || {};
  if (id === 'tendencia') {
    const presentation = normalizeTrendingPresentation(config.presentation);
    return presentation.mode === 'floatingGlass'
      ? trendingSceneImage(presentation, mobile)
      : '';
  }
  if (id === 'look') {
    const look = normalizeLookSection(section);
    return look.style.layoutPreset === 'classic'
      ? ''
      : look.config.editorialBackgroundImage ||
          '/looks-editorial-background.webp';
  }
  if (id === 'complementos')
    return resolveComplementosBackdrop(
      theme,
      normalizeComplementosSection(section)
    ).image;
  if (id === 'categorias')
    return categoriasBackdrop(
      theme,
      config,
      normalizeCategoriasFanStyle(section?.style)
    ).image;
  if (id === 'instagram') {
    const journal = normalizeJournal(config);
    if (mobile && journal.journalMobileBackgroundImage)
      return journal.journalMobileBackgroundImage;
    if (journal.journalBackgroundMode === 'included')
      return '/instagram/journal-satin.webp';
    if (journal.journalBackgroundMode === 'continuity')
      return categoriasBackdrop(theme, {}, { fanBackgroundMode: 'continuity' })
        .image;
    return journal.journalBackgroundMode === 'custom'
      ? journal.journalBackgroundImage
      : '';
  }
  if (id === 'tiktok') {
    const stage = normalizeStage(config);
    if (stage.stageBackgroundMode === 'included')
      return '/instagram/journal-satin.webp';
    if (stage.stageBackgroundMode === 'continuity')
      return categoriasBackdrop(theme, {}, { fanBackgroundMode: 'continuity' })
        .image;
    return stage.stageBackgroundMode === 'custom'
      ? stage.stageBackgroundImage
      : '';
  }
  if (id === 'informacion' && config.layout !== 'classic') {
    const info = normalizeInfoGlass(config);
    return info.backgroundMode === 'satin'
      ? INFO_GLASS_ASSETS + 'satin.webp'
      : info.backgroundMode === 'image'
        ? info.backgroundImage
        : '';
  }
  return '';
}

// Like Home's shared canvas, use the first visible background artwork, skipping
// sections without an image. Resolve responsive assets before choosing a fallback.
export function catalogContinuityBackdrop(theme, mobile = false) {
  if (!theme) return null;
  const journey = normalizeStoryConfig(theme.global?.sectionMotion).journey;
  const entries = Array.isArray(theme.sections) ? theme.sections : [];
  let image = catalogImageUrl(journey.backgroundImage);
  if (!image) {
    for (const id of storySectionOrder(entries)) {
      if (!isStorefrontSectionVisible(theme, id)) continue;
      const section = entries.find(
        (item) => item?.id === id || item?.type === id
      );
      image = catalogImageUrl(sectionImage(theme, id, section, mobile));
      if (image) break;
    }
  }
  return {
    color: theme.colors?.background || 'var(--color-bg, Canvas)',
    image,
  };
}
