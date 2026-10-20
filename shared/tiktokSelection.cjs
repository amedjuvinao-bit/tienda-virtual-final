'use strict';
// Store decisions by stable media ID and account ID, never by expiring CDN URLs.
function selectionFor(config = {}, accountId = '') {
  const raw = config.stageSelection;
  const active = raw && String(raw.accountId) === String(accountId) && accountId;
  const ids = value => new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string' && /^tt_[\w-]{1,100}$/.test(id)) : []);
  return { accountId: String(accountId), mode: active && raw.mode === 'selected' ? 'selected' : 'all',
    included: ids(active ? raw.included : []), excluded: ids(active ? raw.excluded : []) };
}
function isPostVisible(selection, id) {
  return selection.mode === 'selected' ? selection.included.has(id) : !selection.excluded.has(id);
}
function visiblePosts(posts, config, accountId) {
  const selection = selectionFor(config, accountId);
  return orderedPosts(posts.filter(post => isPostVisible(selection, post.id)), config, accountId);
}
function orderFor(config = {}, accountId = '') {
  const raw = config.stageOrder;
  const active = raw && accountId && String(raw.accountId) === String(accountId);
  return { accountId: String(accountId), mode: active && raw.mode === 'manual' ? 'manual' : 'tiktok',
    ids: active && Array.isArray(raw.ids) ? [...new Set(raw.ids.filter(id => typeof id === 'string' && /^tt_[\w-]{1,100}$/.test(id)))] : [] };
}
function orderedPosts(posts, config, accountId) {
  const order = orderFor(config, accountId);
  if (order.mode !== 'manual') return posts;
  const ranks = new Map(order.ids.map((id, index) => [id, index]));
  return [...posts].sort((a, b) => (ranks.get(a.id) ?? order.ids.length) - (ranks.get(b.id) ?? order.ids.length));
}
function movePost(config, accountId, loadedPosts, id, delta) {
  const order = orderFor(config, accountId);
  const visible = visiblePosts(loadedPosts, config, accountId);
  const index = visible.findIndex(post => post.id === id), neighbor = visible[index + delta];
  const ids = [...new Set([...order.ids, ...visible.map(post => post.id)])];
  if (index >= 0 && neighbor) {
    const from = ids.indexOf(id), to = ids.indexOf(neighbor.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
  }
  return { accountId: String(accountId), mode: 'manual', ids };
}
function updateSelection(config, accountId, ids, visible) {
  const selection = selectionFor(config, accountId);
  for (const id of ids) {
    if (visible) { selection.included.add(id); selection.excluded.delete(id); }
    else { selection.included.delete(id); selection.excluded.add(id); }
  }
  return { accountId: selection.accountId, mode: selection.mode, included: [...selection.included], excluded: [...selection.excluded] };
}
module.exports = { selectionFor, isPostVisible, visiblePosts, updateSelection, orderFor, orderedPosts, movePost };
