import boutiqueBackdrop from '../assets/trending-vitrine-boutique.webp';
import runwayBackdrop from '../assets/trending-runway-mobile.webp';

export function trendingSceneImage(presentation, mobile = false) {
  if (mobile && presentation.mobileBackgroundMode === 'color') return '';
  if (mobile && presentation.mobileBackgroundMode === 'custom' && presentation.mobileBackgroundImage) return presentation.mobileBackgroundImage;
  if (presentation.backdropMode === 'custom') return presentation.backgroundImage;
  return presentation.backdropMode === 'boutique' ? (mobile ? runwayBackdrop : boutiqueBackdrop) : '';
}
