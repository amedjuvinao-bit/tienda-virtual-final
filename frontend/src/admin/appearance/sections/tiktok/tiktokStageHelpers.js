import selection from '@shared/tiktok-selection';
export const STAGE_DEFAULTS = {
  stageSource: 'manual', stageTitle: 'Todo pasa aquí', stageSubtitle: 'Descubre nuestros videos',
  stageEyebrow: '', stageListTitle: 'Más videos', stageFollowText: 'Seguir en TikTok', stageVideoText: 'Ver en TikTok',
  stageProfileName: '', stageProfileUser: '', stageProfileLink: '', stageAvatar: '', stageUseAccount: true,
  stageFeaturedId: '', stageFeaturedAccount: '', stageBackgroundMode: 'included', stageBackgroundImage: '',
  stageBackgroundColor: '#f4d9d6', stageBackgroundWash: 0, stageInk: '#790c2d', stageAccent: '#d7b68a',
  stageGlassColor: '#fff5ef', stageGlassOpacity: 23, stageBlur: 8, stageDepth: 6, stageShadow: 24,
  stageReflection: 55, stageTexture: 7, stageRadius: 28, stageFont: 'Georgia, serif',
  stageTitleSize: 82, stageTextSize: 22, stageButtonColor: '#810e33', stageButtonText: '#fff8f2',
  stageMaxWidth: 1680, stagePaddingX: 40, stagePaddingY: 48, stageGap: 24, stageVideoHeight: 720,
  stageLeftWidth: 28, stageRightWidth: 36, stageListSize: 3, stageFit: 'cover',
  stageShowBrand: true, stageShowProfile: true, stageShowAvatar: true, stageShowFollow: true,
  stageShowTitle: true, stageShowSubtitle: true, stageShowList: true, stageShowControls: true,
  stageShowDuration: true, stageMuted: false, stageLoop: false, stageResetOnEnter: true,
  stageMotion: 'fade', stageMotionDuration: 450, stageHover: 'light', stageMotionEnabled: true,
  stageMobileTitleSize: 44, stageMobilePadding: 18, stageMobileVideoHeight: 620,
};
const ranges = {
  stageBackgroundWash:[0,100], stageGlassOpacity:[0,90], stageBlur:[0,24], stageDepth:[0,14], stageShadow:[0,50],
  stageReflection:[0,100], stageTexture:[0,30], stageRadius:[0,48], stageTitleSize:[28,120], stageTextSize:[14,30],
  stageMaxWidth:[900,2200], stagePaddingX:[0,120], stagePaddingY:[0,120], stageGap:[12,60], stageVideoHeight:[360,1000],
  stageLeftWidth:[20,36], stageRightWidth:[26,42], stageListSize:[1,6], stageMotionDuration:[150,1000],
  stageMobileTitleSize:[24,64], stageMobilePadding:[8,32], stageMobileVideoHeight:[300,850],
};
export function normalizeStage(config = {}) {
  const out = {};
  for (const [key, fallback] of Object.entries(STAGE_DEFAULTS)) {
    const value = config[key];
    if (ranges[key]) { const n = value == null || value === '' ? NaN : Number(value); out[key] = Number.isFinite(n) ? Math.max(ranges[key][0], Math.min(ranges[key][1],n)) : fallback; }
    else out[key] = typeof value === typeof fallback ? value : fallback;
  }
  for (const key of ['stageInk','stageAccent','stageGlassColor','stageBackgroundColor','stageButtonColor','stageButtonText']) if (!/^#[\da-f]{6}$/i.test(out[key])) out[key] = STAGE_DEFAULTS[key];
  const enums = { stageSource:['manual','connected'], stageBackgroundMode:['included','continuity','custom','color','global'], stageFit:['cover','contain'], stageMotion:['fade','glide','focus','zoom','none'], stageHover:['light','lift','zoom','none'] };
  for (const [key, values] of Object.entries(enums)) if (!values.includes(out[key])) out[key] = STAGE_DEFAULTS[key];
  out.stageListSize = Math.round(out.stageListSize);
  return out;
}
export function safeStageAsset(value) {
  if (typeof value !== 'string') return '';
  if (/^\/(?![\/\\])[^\\\s]*$/.test(value)) return value;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function safeTiktokLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && /^(www\.)?tiktok\.com$/.test(u.hostname) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
export function tiktokVideoId(post) {
  if (/^\d{10,30}$/.test(post?.tiktokId || '')) return post.tiktokId;
  const link = safeTiktokLink(post?.link);
  return link ? new URL(link).pathname.match(/\/(?:video|player\/v1)\/(\d{10,30})(?:\/|$)/)?.[1] || '' : '';
}
export function stagePosts(posts = [], includeHidden = false) {
  return (Array.isArray(posts) ? posts : []).filter(p => p && (includeHidden || p.enabled !== false)).map((p,i) => ({ ...p,
    id: String(p.id || `manual_${i}`), image: safeStageAsset(p.image || p.thumb),
    link: safeTiktokLink(p.link), videoUrl: safeStageAsset(p.videoUrl), tiktokId: tiktokVideoId(p),
    title: String(p.title || p.caption || p.alt || `Video ${i+1}`).slice(0,150),
    positionX: Math.max(0,Math.min(100,Number(p.positionX ?? 50))), positionY: Math.max(0,Math.min(100,Number(p.positionY ?? 50))),
  })).filter(p => p.image || p.videoUrl || p.tiktokId);
}
export function stagePlan(config, accountId, posts) {
  const owned = !config.stageFeaturedAccount || String(config.stageFeaturedAccount) === String(accountId || '');
  const order = selection.orderFor(config,accountId);
  const s = selection.selectionFor(config,accountId);
  const candidate = owned ? config.stageFeaturedId || '' : '';
  const preferred = candidate.startsWith('tt_') ? selection.isPostVisible(s,candidate) ? candidate : '' : accountId ? '' : candidate;
  const required = [...new Set([preferred,...(order.mode === 'manual' ? order.ids : [])])].filter(id => /^tt_\d+$/.test(id) && selection.isPostVisible(s,id));
  return { preferred, required, missing: required.filter(id => !posts.some(p => p.id === id)) };
}
export function stageIdentity(config, account) {
  const s = normalizeStage(config), use = s.stageUseAccount && account;
  const username = s.stageProfileUser || config.profileUser || '';
  const profileUser = username === '@usuario' ? '' : username;
  return { name: use ? account.name : s.stageProfileName,
    user: use && account.username ? `@${account.username}` : profileUser,
    avatar: safeStageAsset(use ? account.avatar : s.stageAvatar),
    url: safeTiktokLink(s.stageProfileLink || (use ? account.url : '') || (/\/@/.test(config.profileLink || '') ? config.profileLink : '')),
  };
}
export function rgba(hex, opacity) { const h = /^#[\da-f]{6}$/i.test(hex) ? hex : '#fff5ef'; return `rgba(${[1,3,5].map(i => parseInt(h.slice(i,i+2),16)).join(',')},${opacity})`; }
