// Keep one shared implementation for Node and the browser. This pure CommonJS
// module must remain a watched source file rather than a prebundled dependency.
export default function instagramSelectionSource(sourcePath) {
  const normalize = value => value.split('?')[0].replace(/\\/g, '/');
  return {
    name: 'instagram-selection-source',
    enforce: 'pre',
    transform(code, id) {
      if (normalize(id) !== normalize(sourcePath)) return null;
      const assignment = /\bmodule\.exports\s*=/g;
      if ((code.match(assignment) || []).length !== 1) throw new Error('Instagram selection must export one shared helper object.');
      return { code: code.replace(assignment, 'export default'), map: null };
    },
  };
}
