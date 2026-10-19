import { bounded, safeInstagramLink } from './instagramEditorialHelpers';

export const JOURNAL_DEFAULTS = {
  journalTitle: 'El diario de Rosa', journalName: 'Rosa Boutique', journalMonogram: 'RB', journalAvatarImage: '',
  journalSidebarTitle: 'Más momentos', journalSubtitle: 'Momentos que enamoran',
  journalFollowText: 'Seguir en Instagram', journalPostText: 'Ver publicación', journalFeaturedPostId: '',
  journalLimit: 24, journalPageSize: 2,
  journalBackgroundMode: 'included', journalBackgroundImage: '', journalMobileBackgroundImage: '',
  journalBackgroundColor: '#f5ded8', journalBackgroundWash: 0,
  journalInk: '#790d2d', journalAccent: '#b9935b', journalCardColor: '#fff8f3', journalCardOpacity: 52,
  journalButtonColor: '#790d2d', journalButtonTextColor: '#fff8f3',
  journalFont: '"Bodoni Moda", Georgia, serif', journalTitleSize: 52, journalTextSize: 17, journalMobileTitleSize: 32,
  journalMaxWidth: 1540, journalPaddingX: 32, journalPaddingY: 26, journalGap: 28, journalMainWidth: 61,
  journalImageRatio: 1.34, journalMobileImageRatio: 1, journalRadius: 20, journalShadow: 28,
  journalBlur: 18, journalHoverLift: 3, journalMobilePadding: 16,
  journalMaterialRevision: 1, journalGlassEnabled: true, journalGlassDepth: 8,
  journalGlassTexture: 26, journalGlassReflection: 48,
  journalGlassInteractive: true, journalGlassTilt: 1.2,
  journalShowProfile: true, journalShowTitle: true, journalShowFollow: true, journalShowSubtitle: true,
  journalShowHighlights: true, journalShowActions: true, journalShowCaptions: true, journalShowFilters: true, journalShowSidebar: true
};
const ranges = {
  journalLimit: [1, 48], journalPageSize: [1, 6], journalBackgroundWash: [0, 100],
  journalCardOpacity: [20, 100], journalTitleSize: [24, 80], journalTextSize: [13, 24],
  journalMobileTitleSize: [24, 48], journalMaxWidth: [800, 2000],
  journalPaddingX: [0, 100], journalPaddingY: [0, 100], journalGap: [12, 60],
  journalMainWidth: [50, 70], journalImageRatio: [.65, 1.8], journalMobileImageRatio: [.65, 1.5],
  journalRadius: [0, 40], journalShadow: [0, 50], journalBlur: [0, 30],
  journalHoverLift: [0, 8], journalMobilePadding: [8, 32],
  journalMaterialRevision: [1, 1], journalGlassDepth: [0, 16],
  journalGlassTexture: [0, 60], journalGlassReflection: [0, 80], journalGlassTilt: [0, 3]
};
export function normalizeJournal(config = {}) {
  const next = {};
  for (const [key, fallback] of Object.entries(JOURNAL_DEFAULTS)) {
    let value = config[key];
    const previousMaterial = { journalCardOpacity: 78, journalShadow: 20, journalBlur: 14 };
    if ((config.journalMaterialRevision ?? 0) < 1 && value === previousMaterial[key]) value = fallback;
    next[key] = ranges[key] ? bounded(value, ...ranges[key], fallback)
      : typeof value === typeof fallback ? value : fallback;
  }
  next.journalLimit = Math.round(next.journalLimit);
  next.journalPageSize = Math.round(next.journalPageSize);
  if (!['included', 'custom', 'continuity', 'color', 'global'].includes(next.journalBackgroundMode)) next.journalBackgroundMode = 'included';
  return next;
}
export function journalPosts(posts = [], limit = 48) {
  return posts.filter(p => p && p.enabled !== false && (p.image || p.thumb)).map((p, index) => ({
    ...p, id: String(p.id || `post_${index + 1}`), image: p.image || p.thumb,
    kind: p.kind === 'reel' || /\/reels?\//i.test(p.link || '') ? 'reel' : 'photo'
  })).slice(0, limit);
}
export function journalFeaturedId(posts, config) {
  const preferred = config.journalFeaturedPostId || config.editorialFeaturedPostId;
  return posts.find(p => p.id === preferred)?.id || posts[Math.min(posts.length - 1, 4)]?.id || '';
}
export function journalHighlights(config, posts) {
  const source = Array.isArray(config.journalHighlights) ? config.journalHighlights :
    ['Looks', 'Detalles', 'Novedades'].slice(0, posts.length).map((title, i) => ({ id: `highlight_${i}`, title, postId: posts[i].id }));
  return source.filter(h => h && h.enabled !== false).map((h, i) => {
    const post = posts.find(p => p.id === h.postId);
    return { ...h, id: String(h.id || `highlight_${i}`), postId: post?.id || '', image: h.image || post?.image || '', title: h.title || `Destacado ${i + 1}` };
  }).filter(h => h.postId && h.image).slice(0, 8);
}
export function safeJournalVideo(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) return trimmed;
  return safeInstagramLink(trimmed);
}
