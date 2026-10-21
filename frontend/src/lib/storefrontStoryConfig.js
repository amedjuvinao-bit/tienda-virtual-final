export const STORY_PRESETS = [
  { id: 'stack', name: 'Tarjetas superpuestas', description: 'La siguiente sección cubre a la anterior con relieve y una sombra suave.' },
  { id: 'cinema', name: 'Recorrido cinematográfico', description: 'Cada escena se abre desde el centro y presenta su contenido con un fundido.' },
  { id: 'depth', name: 'Profundidad 3D', description: 'Las secciones avanzan con perspectiva e inclinación y descansan al leerlas.' },
  { id: 'cascade', name: 'Cascada editorial', description: 'El título, la imagen y las acciones se descubren en una secuencia escalonada.' },
];
export const STORY_DEFAULTS = { enabled: true, preset: 'stack', intensity: 65, pace: 'balanced', mobileMode: 'adapted' };
export const STORY_VISIBILITY_EVENT='storefront:chapter-visibility';
export function normalizeStoryConfig(raw) {
  const value=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{};
  const intensity=Number(value.intensity);
  return {
    enabled:value.enabled!==false,
    preset:STORY_PRESETS.some(item=>item.id===value.preset)?value.preset:STORY_DEFAULTS.preset,
    intensity:Number.isFinite(intensity)?Math.max(20,Math.min(100,intensity)):STORY_DEFAULTS.intensity,
    pace:['quick','balanced','leisurely'].includes(value.pace)?value.pace:STORY_DEFAULTS.pace,
    mobileMode:['adapted','same','off'].includes(value.mobileMode)?value.mobileMode:STORY_DEFAULTS.mobileMode,
  };
}
export const STORY_SECTION_IDS=['tendencia','look','complementos','categorias','instagram','tiktok','informacion'];
export function storySectionOrder(sections) {
  const ordered=(Array.isArray(sections)?sections:[]).map(item=>item?.id).filter(id=>STORY_SECTION_IDS.includes(id));
  return [...new Set([...ordered,...STORY_SECTION_IDS])];
}
export const clampStory = value=>Math.max(0,Math.min(1,value));
export function storyVisual(preset,enter,exit,strength=1) {
  const p=clampStory(enter), reveal=p*p*(3-2*p), incoming=1-reveal, leaving=clampStory(exit);
  if(preset==='stack')return {transform:leaving?`translate3d(0,${-12*leaving*strength}px,0) scale(${1-.035*leaving*strength})`:'none',opacity:1-.18*leaving*strength,radius:28*incoming*strength,clip:incoming>.001?`inset(0 round ${28*incoming*strength}px ${28*incoming*strength}px 0 0)`:'none'};
  if(preset==='cinema')return {transform:incoming>.001?`translate3d(0,${44*incoming*strength}px,0)`:'none',opacity:1-.65*incoming,clip:incoming>.001?`inset(0 ${12*incoming*strength}% 0 round ${32*incoming}px)`:'none',radius:0};
  if(preset==='depth')return {transform:incoming>.001?`perspective(1200px) translate3d(0,${66*incoming*strength}px,0) rotateX(${9*incoming*strength}deg) rotateY(${-4*incoming*strength}deg) scale(${1-.055*incoming*strength})`:'none',opacity:1-.4*incoming,clip:incoming>.001?`inset(0 round ${24*incoming}px)`:'none',radius:24*incoming};
  return {transform:incoming>.001?`translate3d(0,${18*incoming*strength}px,0)`:'none',opacity:1-.2*incoming,clip:'none',radius:0};
}
