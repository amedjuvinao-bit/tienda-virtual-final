// Encode the normal of a rounded glass lip in the red/green displacement
// channels. Blue stores the convex height used for the specular reflection.
// The face and everything outside the lip stay neutral for displacement.
export function glassRefractionPixels(width, height, radius, rim, mapWidth, mapHeight) {
  const pixels = new Uint8ClampedArray(mapWidth * mapHeight * 4);
  const curve = Math.max(0, Math.min(radius, width / 2, height / 2));
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const px = (x + .5) * width / mapWidth - width / 2;
      const py = (y + .5) * height / mapHeight - height / 2;
      const qx = Math.abs(px) - (width / 2 - curve);
      const qy = Math.abs(py) - (height / 2 - curve);
      const cornerDistance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const distance = -(cornerDistance + Math.min(Math.max(qx, qy), 0) - curve);
      let nx = 0, ny = 0;
      if (qx > 0 && qy > 0) {
        nx = qx / cornerDistance * Math.sign(px);
        ny = qy / cornerDistance * Math.sign(py);
      } else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);
      const bend = distance > 0 && distance < rim ? Math.sin(distance / rim * Math.PI) * .95 : 0;
      const index = (y * mapWidth + x) * 4;
      pixels[index] = 128 + nx * bend * 127;
      pixels[index + 1] = 128 + ny * bend * 127;
      const t = Math.max(0, Math.min(1, distance / rim));
      pixels[index + 2] = Math.sqrt(1 - (1 - t) ** 2) * 255;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

const cache = new Map();
export function glassRefractionMap(width, height, radius, rim) {
  if (!width || !height || typeof window === 'undefined' || !window.CanvasRenderingContext2D) return '';
  const key = [width, height, radius, rim].join(':');
  if (cache.has(key)) return cache.get(key);
  const scale = Math.min(1, 480 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) return '';
  const data = context.createImageData(canvas.width, canvas.height);
  data.data.set(glassRefractionPixels(width, height, radius, rim, canvas.width, canvas.height));
  context.putImageData(data, 0, 0);
  const image = canvas.toDataURL();
  if (cache.size >= 24) cache.delete(cache.keys().next().value);
  cache.set(key, image);
  return image;
}
