// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import instagramSelectionSource from './instagramSelectionSource';

const path = fileURLToPath(new URL('../../shared/instagramSelection.cjs', import.meta.url));
describe('Instagram helpers served as source', () => {
  it('exports the current shared ordering and visibility implementation as browser ESM', async () => {
    const plugin = instagramSelectionSource(path);
    const { code } = plugin.transform(readFileSync(path, 'utf8'), path);
    expect(code).not.toContain('module.exports');
    const { default: helpers } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    for (const name of ['selectionFor', 'isPostVisible', 'visiblePosts', 'updateSelection', 'orderFor', 'orderedPosts', 'movePost']) expect(typeof helpers[name]).toBe('function');
    const config = { journalConnectedOrder: { accountId: '123', mode: 'manual', ids: ['ig_two', 'ig_one'] } };
    expect(helpers.visiblePosts([{ id: 'ig_one' }, { id: 'ig_two' }], config, '123').map(p => p.id)).toEqual(['ig_two', 'ig_one']);
  });
  it('normalizes Windows paths and leaves unrelated CommonJS dependencies unchanged', () => {
    const plugin = instagramSelectionSource('C:\\project\\shared\\instagramSelection.cjs');
    expect(plugin.transform('module.exports = { orderFor() {} };', 'C:/project/shared/instagramSelection.cjs?t=1').code).toContain('export default');
    expect(plugin.transform('module.exports = {};', 'C:/project/shared/another.cjs')).toBeNull();
  });
});
