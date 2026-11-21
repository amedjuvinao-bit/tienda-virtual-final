const bell = (value, center, spread) => Math.exp(-Math.pow((value - center) / spread, 2));

// Two transparent masks describe a rounded lens cross-section. Color stays in
// CSS so the same relief follows the palette selected in the editor.
export function glassBevelPixels(width, height, radius, rim, mapWidth, mapHeight) {
  const light = new Uint8ClampedArray(mapWidth * mapHeight * 4);
  const shade = new Uint8ClampedArray(light.length);
  const curve = Math.max(0, Math.min(radius, width / 2, height / 2));
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const px = (x + .5) * width / mapWidth - width / 2;
      const py = (y + .5) * height / mapHeight - height / 2;
      const qx = Math.abs(px) - (width / 2 - curve);
      const qy = Math.abs(py) - (height / 2 - curve);
      const length = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const distance = -(length + Math.min(Math.max(qx, qy), 0) - curve);
      if (distance <= 0 || distance >= rim) continue;
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) {
        nx = qx / length * Math.sign(px);
        ny = qy / length * Math.sign(py);
      } else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);
      const corner = Math.abs(nx * ny) * 2;
      const returnLight = Math.min(1, .84 + Math.max(ny, 0) * .15 + Math.max(-nx, 0) * .1 + corner * .15);
      const grazingLight = .8 + Math.max(0, -nx - ny) * .1 + corner * .1;
      const fade = Math.min(1, (rim - distance) / Math.min(.8, rim * .2));
      const shine = (
        bell(distance, rim * .115, Math.max(.2, rim * .04)) * grazingLight * .94 +
        bell(distance, rim * .65, rim * .16) * returnLight * .96 +
        Math.sin(distance / rim * Math.PI) * .035
      ) * fade;
      const depth = (
        bell(distance, rim * .042, Math.max(.2, rim * .037)) * .8 +
        bell(distance, rim * .32, rim * .14) * .52 +
        bell(distance, rim * .94, Math.max(.2, rim * .05)) * .22
      ) * fade;
      const index = (y * mapWidth + x) * 4;
      light[index] = light[index + 1] = light[index + 2] = 255;
      shade[index] = shade[index + 1] = shade[index + 2] = 255;
      light[index + 3] = Math.min(.98, shine) * 255;
      shade[index + 3] = Math.min(.9, depth) * 255;
    }
  }
  return { light, shade };
}

const cache = new Map();
export function glassBevelMasks(width, height, radius, rim) {
  if (!width || !height || !rim || typeof window === 'undefined' || !window.CanvasRenderingContext2D) return null;
  const key = [width, height, radius, rim].join(':');
  if (cache.has(key)) return cache.get(key);
  const scale = Math.min(1.5, 1920 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = glassBevelPixels(width, height, radius, rim, canvas.width, canvas.height);
  const masks = {};
  for (const name of ['shade', 'light']) {
    const data = context.createImageData(canvas.width, canvas.height);
    data.data.set(pixels[name]);
    context.putImageData(data, 0, 0);
    masks[name] = canvas.toDataURL();
  }
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, masks);
  return masks;
}
