const rgb = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
const blend = (from, to, amount) => from.map((value, index) => value + (to[index] - value) * amount);

// Map the artwork's light levels to the selected palette, keeping its original
// opacity. Converting light levels into transparency erases white glass relief.
export function catalogGlassToneTables({ color, depthColor, depth, reflectionColor, reflection, shadeScale = 1 }) {
  const base = rgb(color), shade = rgb(depthColor).map(channel => channel * shadeScale), light = rgb(reflectionColor);
  const samples = Array.from({ length: 33 }, (_, index) => {
    const luminance = index / 32;
    const relief = Math.min(1, (1 - luminance) / .35);
    const highlight = Math.pow(Math.max(0, (luminance - .87) / .13), 1.25) * reflection;
    return blend(blend(base, shade, depth * relief), light, highlight);
  });
  return [0, 1, 2].map(channel => samples.map(sample => sample[channel].toFixed(6)).join(' '));
}
