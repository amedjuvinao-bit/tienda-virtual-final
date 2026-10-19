export const EDITORIAL_DEFAULTS = {
  editorialRevision: 2,
  editorialVisibleCount: 5,
  editorialFeaturedPostId: '',
  editorialImageFit: 'cover',
  editorialFollowTextColor: '#790d2d',
  editorialTitle: 'Instagram',
  editorialSubtitle: 'Momentos que enamoran',
  editorialUseTitleImage: false,
  editorialShowProfile: true,
  editorialShowTitle: true,
  editorialShowFollow: true,
  editorialShowSubtitle: true,
  editorialShowPostAction: true,
  editorialFollowText: 'Seguir en Instagram',
  editorialPostText: 'Ver publicación',
  editorialBackgroundMode: 'included',
  editorialBackgroundImage: '',
  editorialMobileBackgroundImage: '',
  editorialBackgroundColor: '#edbdb1',
  editorialBackgroundWash: 8,
  editorialTitleColor: '#790d2d',
  editorialTextColor: '#790d2d',
  editorialBorderColor: '#ffe6c8',
  editorialButtonColor: '#f1b6ae',
  editorialActionColor: '#790d2d',
  editorialActionTextColor: '#fff5ec',
  editorialFont: '"Bodoni Moda", Georgia, serif',
  editorialTitleSize: 300,
  editorialTitleWeight: 400,
  editorialProfileX: 18,
  editorialProfileY: 0,
  editorialLogoSize: 28,
  editorialUseProfileLogo: false,
  editorialFooterX: 1,
  editorialFooterY: 2,
  editorialFooterWidth: 32,
  editorialSubtitleSize: 20,
  editorialBackgroundX: 50,
  editorialBackgroundY: 50,
  editorialMobilePaddingY: 24,
  editorialProfileSize: 24,
  editorialButtonSize: 24,
  editorialTitleTop: 1,
  editorialMaxWidth: 1920,
  editorialWidthMode: 'full',
  editorialHeight: 900,
  editorialPaddingX: 32,
  editorialPaddingY: 20,
  editorialRadius: 24,
  editorialBorderWidth: 2,
  editorialShadow: 35,
  editorialTilt: true,
  editorialMotion: 'lift',
  editorialLift: 12,
  editorialZoom: 1.04,
  editorialDuration: 380,
  editorialActionSize: 118,
  editorialButtonRadius: 99,
  editorialButtonBlur: 12,
  editorialMobileColumns: 2,
  editorialMobileGap: 12,
  editorialMobilePadding: 16,
  editorialMobileTitleSize: 66,
  editorialMobilePhotoRatio: 0.75
};
const ranges = {
  editorialRevision: [2, 2],
  editorialVisibleCount: [1, 12],
  editorialBackgroundWash: [0, 100],
  editorialTitleSize: [70, 420],
  editorialTitleWeight: [100, 900],
  editorialProfileX: [0, 80],
  editorialProfileY: [0, 40],
  editorialLogoSize: [16, 80],
  editorialFooterX: [0, 70],
  editorialFooterY: [0, 40],
  editorialFooterWidth: [18, 70],
  editorialSubtitleSize: [12, 36],
  editorialBackgroundX: [0, 100],
  editorialBackgroundY: [0, 100],
  editorialMobilePaddingY: [0, 80],
  editorialProfileSize: [12, 40],
  editorialButtonSize: [12, 40],
  editorialTitleTop: [0, 20],
  editorialMaxWidth: [800, 2560],
  editorialHeight: [600, 1600],
  editorialPaddingX: [0, 120],
  editorialPaddingY: [0, 120],
  editorialRadius: [0, 80],
  editorialBorderWidth: [0, 10],
  editorialShadow: [0, 80],
  editorialLift: [0, 40],
  editorialZoom: [1, 1.2],
  editorialDuration: [100, 1200],
  editorialActionSize: [60, 180],
  editorialButtonRadius: [0, 100],
  editorialButtonBlur: [0, 30],
  editorialMobileColumns: [1, 2],
  editorialMobileGap: [4, 32],
  editorialMobilePadding: [8, 40],
  editorialMobileTitleSize: [28, 110],
  editorialMobilePhotoRatio: [0.5, 1.5]
};
export function bounded(value, min, max, fallback) {
  const n = value == null || value === '' ? NaN : Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
export function normalizeEditorial(config = {}) {
  const next = {};
  for (const [key, fallback] of Object.entries(EDITORIAL_DEFAULTS)) {
    let v = config[key];
    // Correct the first release's defaults without replacing deliberate custom settings.
    const oldDefaults = {
      editorialFont: 'Georgia, serif',
      editorialTitleSize: 290,
      editorialTitleTop: 0
    };
    if (config.editorialRevision !== 2 && v === oldDefaults[key]) v = fallback;
    next[key] = ranges[key] ? bounded(v, ...ranges[key], fallback) : typeof v === typeof fallback ? v : fallback;
  }
  if (!['included', 'continuity', 'custom', 'color', 'global'].includes(next.editorialBackgroundMode)) next.editorialBackgroundMode = 'included';
  if (!['full', 'limited'].includes(next.editorialWidthMode)) next.editorialWidthMode = 'full';
  if (!['none', 'lift', 'zoom', 'lift-zoom'].includes(next.editorialMotion)) next.editorialMotion = 'lift';
  if (!['contain', 'cover'].includes(next.editorialImageFit)) next.editorialImageFit = 'cover';
  next.editorialVisibleCount = Math.round(next.editorialVisibleCount);
  next.editorialMobileColumns = Math.round(next.editorialMobileColumns);
  return next;
}
const positions = [{
  x: 5,
  y: 23,
  width: 32,
  height: 59,
  rotate: 8,
  layer: 1
}, {
  x: 41,
  y: 17,
  width: 30,
  height: 77,
  rotate: -5,
  layer: 3
}, {
  x: 72,
  y: 19,
  width: 25,
  height: 40,
  rotate: -9,
  layer: 2
}, {
  x: 26,
  y: 54,
  width: 19,
  height: 33,
  rotate: -6,
  layer: 4
}, {
  x: 72,
  y: 57,
  width: 23,
  height: 34,
  rotate: 6,
  layer: 4
}];
export function photoLayout(post = {}, index = 0) {
  const fallback = positions[index] || {
    x: 0,
    y: 0,
    width: 25,
    height: 40,
    rotate: 0,
    layer: 1
  };
  return Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, bounded(post['editorial' + k[0].toUpperCase() + k.slice(1)], k === 'rotate' ? -15 : ['layer', 'width', 'height'].includes(k) ? 1 : 0, k === 'rotate' ? 15 : k === 'layer' ? 10 : 100, v)]));
}
export function photoCrop(post = {}) {
  return {
    x: bounded(post.imagePositionX, 0, 100, 50),
    y: bounded(post.imagePositionY, 0, 100, 50),
    zoom: bounded(post.imageScale, 1, 2, 1)
  };
}
// Only web URLs can become external anchors; missing post links never open another post or the profile.
export function safeInstagramLink(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

// Assign the chosen publication to the tall central frame without reordering or editing saved records.
export function editorialPhotoSlot(visiblePosts, post, config) {
  const index = visiblePosts.indexOf(post);
  const chosen = visiblePosts.findIndex(item => item.id && item.id === config.editorialFeaturedPostId);
  const featured = chosen >= 0 ? chosen : visiblePosts.length >= 5 ? 4 : Math.min(1, visiblePosts.length - 1);
  if (index === featured) return Math.min(1, visiblePosts.length - 1);
  if (index === 1) return featured;
  return index;
}
