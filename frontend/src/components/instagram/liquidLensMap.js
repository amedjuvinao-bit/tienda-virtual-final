// A neutral center and inward edge normals form a rounded lens, rather than
// turbulent noise. No product image is sampled or redrawn by this map.
export function liquidLensPixels(width, height, radius, edge) {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const band = Math.max(1, edge);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = x + .5 - width / 2, py = y + .5 - height / 2;
    const qx = Math.abs(px) - (width / 2 - r), qy = Math.abs(py) - (height / 2 - r);
    const ax = Math.max(qx, 0), ay = Math.max(qy, 0), length = Math.hypot(ax, ay);
    const distance = length + Math.min(Math.max(qx, qy), 0) - r;
    let nx = 0, ny = 0;
    if (qx > 0 && qy > 0 && length) { nx = ax / length; ny = ay / length; }
    else if (qx > qy) nx = 1;
    else ny = 1;
    const bend = distance <= 0 ? Math.max(0, 1 + distance / band) ** 2 : 0;
    const i = (y * width + x) * 4;
    data[i] = 128 - Math.sign(px) * nx * bend * 116;
    data[i + 1] = 128 - Math.sign(py) * ny * bend * 116;
    data[i + 2] = 128; data[i + 3] = 255;
  }
  return data;
}

const maps = new Map();
export function createLiquidLensMap(width, height, radius, edge) {
  if (typeof CanvasRenderingContext2D === 'undefined' || width < 1 || height < 1) return '';
  const key = [Math.round(width), Math.round(height), radius, edge].join(':');
  if (maps.has(key)) return maps.get(key);
  const scale = Math.min(1, 256 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const context = canvas.getContext('2d'); if (!context) return '';
  const pixels = context.createImageData(w, h);
  pixels.data.set(liquidLensPixels(w, h, radius * scale, edge * scale));
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL('image/png');
  if (maps.size >= 20) maps.delete(maps.keys().next().value);
  maps.set(key, url);
  return url;
}
