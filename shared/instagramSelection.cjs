'use strict';
// Store decisions by stable media ID and account ID, never by expiring CDN URLs.
function selectionFor(config = {}, accountId = '') {
  const raw = config.journalConnectedSelection;
  const active = raw && String(raw.accountId) === String(accountId) && accountId;
  const ids = value => new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string' && /^ig_[\w-]{1,100}$/.test(id)) : []);
  return { accountId: String(accountId), mode: active && raw.mode === 'selected' ? 'selected' : 'all',
    included: ids(active ? raw.included : []), excluded: ids(active ? raw.excluded : []) };
}
function isPostVisible(selection, id) {
  return selection.mode === 'selected' ? selection.included.has(id) : !selection.excluded.has(id);
}
function visiblePosts(posts, config, accountId) {
  const selection = selectionFor(config, accountId);
  return posts.filter(post => isPostVisible(selection, post.id));
}
function updateSelection(config, accountId, ids, visible) {
  const selection = selectionFor(config, accountId);
  for (const id of ids) {
    if (visible) { selection.included.add(id); selection.excluded.delete(id); }
    else { selection.included.delete(id); selection.excluded.add(id); }
  }
  return { accountId: selection.accountId, mode: selection.mode, included: [...selection.included], excluded: [...selection.excluded] };
}
module.exports = { selectionFor, isPostVisible, visiblePosts, updateSelection };
