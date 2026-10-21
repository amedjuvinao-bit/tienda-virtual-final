export const STORY_PRESETS = [
  { id: 'stack', name: 'Tarjetas superpuestas', description: 'Una tarjeta avanza sobre otra, que se hunde y se inclina entre bordes de luz.' },
  { id: 'cinema', name: 'Recorrido cinematográfico', description: 'Un portal ovalado se expande y descubre la siguiente escena con un acercamiento de cámara.' },
  { id: 'depth', name: 'Profundidad 3D', description: 'Escenarios que giran desde los lados, avanzan hacia el frente y desplazan al anterior.' },
  { id: 'cascade', name: 'Cascada editorial', description: 'Páginas que se cruzan en diagonal, con títulos recortados e imágenes que entran por turnos.' },
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
// Entry and handoff share one scroll timeline. Strength changes the staging,
// while a completely read scene always returns control to its native design.
export function storyVisual(preset, enter, exit, strength=1, side=1) {
  const p=clampStory(enter), reveal=p*p*(3-2*p), incoming=1-reveal;
  const e=clampStory(exit), leaving=e*e*(3-2*e), s=strength;
  const moving=incoming>.001 || leaving>.001;
  const energy=Math.sin(p*Math.PI)*s;
  const base={transform:'none',opacity:1,clip:'none',radius:0,light:energy,edge:0,sweep:(p*160-40)*side,portalX:120,portalY:150};
  if(!moving)return base;
  if(preset==='stack')return {...base,
    transform:`perspective(1600px) translate3d(0,${(70*incoming-65*leaving)*s}px,${-150*leaving*s}px) rotateX(${(5*incoming+9*leaving)*s}deg) scale(${1-(.055*incoming+.11*leaving)*s})`,
    opacity:1-.26*leaving*s,
    radius:(52*incoming+38*leaving)*s,
    edge:Math.max(incoming,leaving)*s,
    light:Math.max(energy,.3*leaving*s),
  };
  if(preset==='cinema') {
    // Hold the aperture until the scene is on screen, then open it broadly.
    // A linear radius becomes full-width while it is still below the fold.
    const aperture=Math.pow(p,2.8);
    const portalX=120-(90+12*s)*(1-aperture);
    const portalY=150-(120+16*s)*(1-aperture);
    return {...base,
      transform:`translate3d(0,${-35*incoming*s}px,0) scale(${1+(.18*incoming+.07*leaving)*s})`,
      opacity:1-.42*leaving*s,
      clip:incoming>.001?`ellipse(${portalX}% ${portalY}% at 50% 14%)`:'none',
      portalX,portalY,
      light:energy*.8,
      edge:incoming*s,
    };
  }
  if(preset==='depth')return {...base,
    transform:`perspective(1400px) translate3d(${side*(14*incoming-9*leaving)*s}%,${(95*incoming-28*leaving)*s}px,${-(240*incoming+150*leaving)*s}px) rotateX(${(14*incoming-5*leaving)*s}deg) rotateY(${side*(-24*incoming+17*leaving)*s}deg) rotateZ(${side*(-4*incoming+2*leaving)*s}deg) scale(${1-(.08*incoming+.06*leaving)*s})`,
    opacity:1-.35*leaving*s,
    radius:(48*incoming+32*leaving)*s,
    light:energy*.7,
    edge:Math.max(incoming,leaving)*s,
  };
  return {...base,
    transform:`translate3d(${side*(17*incoming-5*leaving)*s}%,${(75*incoming-35*leaving)*s}px,0) rotate(${side*(5*incoming-2*leaving)*s}deg) scale(${1-(.07*incoming+.04*leaving)*s})`,
    opacity:1-.2*leaving*s,
    clip:incoming>.001?`inset(0 ${7*incoming*s}% 0 round ${40*incoming*s}px)`:'none',
    radius:(40*incoming+22*leaving)*s,
    edge:Math.max(incoming,leaving)*s,
  };
}

// Individual translate/scale/rotate compose with each section's own transforms.
// The engine releases these keyframes once the entrance finishes.
export function storyContentFrames(preset,kind,strength,side=1) {
  const s=strength;
  let from={opacity:.2,translate:`0 ${65*s}px`};
  if(kind==='heading')from={opacity:0,translate:`${preset==='cascade'?-12*s:0}% ${90*s}%`,clipPath:'inset(0 0 100% 0)'};
  else if(kind==='action')from={opacity:0,translate:`${18*side*s}px ${35*s}px`};
  else if(preset==='stack')from={opacity:.35,translate:`0 ${100*s}px`,scale:String(1-.12*s),rotate:`${-3*side*s}deg`};
  else if(preset==='cinema')from={opacity:.4,translate:`0 ${10*s}%`,scale:String(1+.25*s)};
  else if(preset==='depth')from={opacity:.3,translate:`${-14*side*s}% ${80*s}px`,scale:String(1-.12*s),rotate:`${6*side*s}deg`};
  else from={opacity:.15,translate:`${28*side*s}% ${70*s}px`,scale:String(1+.12*s),rotate:`${-7*side*s}deg`};
  const to=Object.fromEntries(Object.keys(from).map(key=>[key,({opacity:1,translate:'0 0',scale:'1',rotate:'0deg',clipPath:'inset(0 0 0 0)'})[key]]));
  return [from,to];
}
