'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderFor, orderedPosts, visiblePosts, movePost } = require('../../shared/instagramSelection.cjs');
const posts = ['one', 'two', 'three'].map(id => ({ id: `ig_${id}` }));
test('Instagram manual order uses stable IDs, appends new posts, and does not mutate the feed', () => {
  const config = { journalConnectedOrder: { accountId: '123', mode: 'manual', ids: ['ig_three', 'ig_one', 'ig_three', 'invalid'] } };
  const original = JSON.stringify(posts);
  assert.deepEqual(orderFor(config, '123').ids, ['ig_three', 'ig_one']);
  assert.deepEqual(orderedPosts(posts, config, '123').map(p => p.id), ['ig_three', 'ig_one', 'ig_two']);
  assert.equal(JSON.stringify(posts), original);
  assert.deepEqual(orderedPosts(posts, config, 'other'), posts);
  assert.deepEqual(orderedPosts(posts, { journalConnectedOrder: { ...config.journalConnectedOrder, mode: 'instagram' } }, '123'), posts);
});
test('moving posts preserves unloaded decisions and does not publish hidden posts', () => {
  const config = { journalConnectedOrder: { accountId: '123', mode: 'manual', ids: ['ig_one', 'ig_later', 'ig_two', 'ig_three'] },
    journalConnectedSelection: { accountId: '123', mode: 'all', excluded: ['ig_two'] } };
  const moved = movePost(config, '123', posts, 'ig_three', -1);
  assert.deepEqual(moved.ids, ['ig_three', 'ig_later', 'ig_two', 'ig_one']);
  assert.deepEqual(visiblePosts(posts, { ...config, journalConnectedOrder: moved }, '123').map(p => p.id), ['ig_three', 'ig_one']);
  assert.deepEqual(config.journalConnectedSelection.excluded, ['ig_two']);
});
