import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve('../docs/previews/admin-loading');
fs.mkdirSync(target, { recursive: true });

const models = [
  { id: 'halo', name: 'Halo' },
  { id: 'pulse', name: 'Pulso' },
  { id: 'orbit', name: 'Órbita' },
  { id: 'wave', name: 'Onda' },
  { id: 'linear', name: 'Línea' },
];

function visual(id) {
  if (id === 'halo') return '<circle cx="320" cy="79" r="17" fill="none" stroke="#506477" stroke-opacity=".24" stroke-width="3"/><path d="M 320 62 A 17 17 0 0 1 337 79" fill="none" stroke="#506477" stroke-width="3" stroke-linecap="round"/>';
  if (id === 'pulse') return [302, 320, 338].map((x, i) => `<circle cx="${x}" cy="79" r="5" fill="#506477" fill-opacity="${[.45, 1, .7][i]}"/>`).join('');
  if (id === 'orbit') return '<circle cx="320" cy="60" r="5" fill="#506477"/><circle cx="336" cy="89" r="5" fill="#506477" fill-opacity=".6"/><circle cx="304" cy="89" r="5" fill="#506477" fill-opacity=".36"/>';
  if (id === 'wave') return [0, 1, 2, 3, 4].map((n) => `<rect x="${300 + n * 10}" y="${n === 2 ? 64 : n % 2 ? 72 : 68}" width="4" height="${n === 2 ? 30 : n % 2 ? 14 : 22}" rx="2" fill="#506477"/>`).join('');
  return '<rect x="292" y="77" width="56" height="4" rx="2" fill="#506477" fill-opacity=".2"/><rect x="292" y="77" width="23" height="4" rx="2" fill="#506477"/>';
}

for (const model of models) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200" viewBox="0 0 640 200">
    ${visual(model.id)}
    <text x="320" y="127" text-anchor="middle" fill="#304257" font-family="DejaVu Sans" font-size="15" font-weight="600">Preparando tu panel…</text>
    <text x="320" y="174" text-anchor="middle" fill="#506477" font-family="DejaVu Sans" font-size="13">${model.name}</text>
  </svg>`;
  fs.writeFileSync(path.join(target, `${model.id}.svg`), svg);
}
