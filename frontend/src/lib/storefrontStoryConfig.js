export const STORY_PRESETS = [
  { id: 'stack', name: 'Baraja en relieve', description: 'Una tarjeta se desliza de lado y ocupa la pantalla; la anterior queda detrás, inclinada y con sombra.' },
  { id: 'cinema', name: 'Apertura de cristal', description: 'La nueva sección se abre desde el centro, entre dos bordes de cristal que se separan.' },
  { id: 'depth', name: 'Libro 3D', description: 'Cada sección gira sobre un borde como una página; el pliegue proyecta luz y sombra.' },
  { id: 'cascade', name: 'Mosaico por bloques', description: 'Nueve ventanas descubren la siguiente sección por turnos, con un recorrido diagonal.' },
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
// Each preset has its own mechanism. Intensity changes the depth, while even
// low settings retain the defining gesture. A fully read scene has no effects.
export function storyVisual(preset, enter, exit, strength=1, side=1) {
  const p=clampStory(enter), e=clampStory(exit), reveal=p*p*(3-2*p), incoming=1-reveal;
  const leaving=e*e*(3-2*e), s=.45+.55*clampStory(strength);
  const base={transform:'none',opacity:1,clip:'none',radius:0,light:0,edge:0,sweep:(p*160-40)*side,opening:0,fold:0,originX:'50%'};
  if(p===1 && e===0)return base;
  const arrival=clampStory(p/.12), edge=Math.sin(p*Math.PI);
  if(preset==='stack')return {...base,
    transform:`perspective(1500px) translate3d(${side*(46*incoming-8*leaving)*s}%,${(110*incoming-50*leaving)*s}px,${-260*leaving*s}px) rotateX(${(12*incoming+12*leaving)*s}deg) rotateZ(${side*(12*incoming-5*leaving)*s}deg) scale(${1-(.24*incoming+.18*leaving)*s})`,
    opacity:arrival*(1-.22*leaving),radius:(38*incoming+28*leaving)*s,
    clip:`inset(0 round ${(38*incoming+28*leaving)*s}px)`,
    edge:Math.max(incoming,leaving)*s,light:edge*.6*s,
  };
  if(preset==='cinema')return {...base,
    transform:leaving?`scale(${1+.14*leaving*s})`:'none',
    clip:p<1?`inset(0 ${50*incoming}% 0 ${50*incoming}%)`:'none',
    opening:50*incoming,edge:edge*s,light:edge*.28,
    opacity:1-.18*leaving,
  };
  if(preset==='depth')return {...base,
    transform:`perspective(1200px) rotateY(${side*(-86*incoming+42*leaving)*s}deg)`,
    originX:side>0?'100%':'0%',opacity:arrival,
    fold:Math.max(incoming,leaving)*s,edge:Math.max(incoming,leaving)*s,
    light:edge*.45*s,
  };
  return {...base,edge:edge*.4,light:edge*.35,opacity:1};
}

// Content participates in the chosen scene instead of repeating one fade/zoom.
// Individual transforms compose with the component's own hover and media styles.
export function storyContentFrames(preset,kind,strength,side=1) {
  const s=.45+.55*clampStory(strength);
  let from={opacity:1};
  if(preset==='stack')from=kind==='heading'?{opacity:0,translate:`${-28*side*s}px 0`}:kind==='visual'?{opacity:1,translate:`0 ${55*s}px`,rotate:`${-4*side*s}deg`}:{opacity:0,translate:`0 ${20*s}px`};
  if(preset==='cinema' && kind==='heading')from={opacity:1,clipPath:'inset(0 50% 0 50%)'};
  if(preset==='depth' && kind==='visual')from={opacity:1,translate:`${18*side*s}px 0`};
  const to=Object.fromEntries(Object.keys(from).map(key=>[key,({opacity:1,translate:'0 0',rotate:'0deg',clipPath:'inset(0 0 0 0)'})[key]]));
  return [from,to];
}
