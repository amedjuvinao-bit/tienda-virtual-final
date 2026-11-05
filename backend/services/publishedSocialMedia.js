'use strict';
const Site = require('../models/SiteSettings');
const providers = {
  instagram: { Settings: require('../models/InstagramSettings'), Pages: require('../models/InstagramFeedPage'), selection: require('../../shared/instagramSelection.cjs') },
  tiktok: { Settings: require('../models/TiktokSettings'), Pages: require('../models/TiktokFeedPage'), selection: require('../../shared/tiktokSelection.cjs') },
};

// Exact equality with published assets. Never fetch a URL simply because a
// visitor supplied it, and never consult draft settings or hidden feed posts.
function containsAsset(value, source) {
  if (typeof value === 'string') return value === source;
  if (!value || typeof value !== 'object' || value.enabled === false) return false;
  return Object.entries(value).some(([key, item]) => key !== 'enabled' && containsAsset(item, source));
}

function createPublishedMediaAccess({ SiteModel = Site, sources = providers } = {}) {
  return async (source, provider) => {
    const site = await SiteModel.findOne().select('theme').lean();
    const theme = site?.theme;
    if (!theme) return false;
    const sections = (theme.sections || []).filter(section => section?.enabled !== false);
    // Includes custom backgrounds, profile images, mobile crops and albums.
    const publishedSections = sections.map(item => {
      const config = item.config || {};
      if (config.journalSource !== 'connected' && config.stageSource !== 'connected') return item;
      const { posts: _manualPosts, ...assets } = config;
      return { ...item, config: assets };
    });
    if (containsAsset({ ...theme, sections: publishedSections }, source)) return true;
    const section = sections.find(item => item.id === provider || item.type === provider);
    if (!section) return false;
    const config = section.config || {};
    const connected = provider === 'instagram' ? config.journalSource === 'connected' : config.stageSource === 'connected';
    if (!connected) return false;
    const { Settings, Pages, selection } = sources[provider];
    const settings = await Settings.findOne({ key: 'main' }).select('enabled account connectionId').lean();
    if (!settings?.enabled || !settings.account || !settings.connectionId) return false;
    if (settings.account.avatar === source) return true;
    const pages = await Pages.find({ connection: settings.connectionId, expiresAt: { $gt: new Date() }, $or: [
      { 'posts.image': source }, { 'posts.thumb': source }, { 'posts.videoUrl': source },
      { 'posts.album.image': source }, { 'posts.album.videoUrl': source },
    ] }).select('posts').limit(8).lean();
    return pages.some(page => selection.visiblePosts(page.posts || [], config, settings.account.id)
      .some(post => containsAsset(post, source)));
  };
}
module.exports = { createPublishedMediaAccess, containsAsset };
