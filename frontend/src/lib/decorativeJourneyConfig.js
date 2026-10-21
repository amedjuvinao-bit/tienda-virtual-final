export const JOURNEY_SECTION_IDS=['banner','tendencia','look','complementos','categorias','instagram','tiktok','informacion','footer'];
export const DECORATIVE_JOURNEY_DEFAULTS={
  image:'',secondaryImage:'',backgroundImage:'',
  unifyBackground:false,path:'flowing',size:190,density:22,opacity:90,depth:65,
  mobileSize:86,mobileDensity:10,stemVisible:false,stemColor:'',sectionSettings:{},
};
const number=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
export function journeyImageUrl(value,fallback=''){
  if(typeof value!=='string')return fallback;
  const url=value.trim();
  return url.length<=2048 && !/[\u0000-\u001f]/.test(url) && /^(?:\/(?!\/)|https?:\/\/)/i.test(url)?url:'';
}
export function normalizeDecorativeJourney(raw){
  const c=raw && typeof raw==='object' && !Array.isArray(raw)?raw:{}, d=DECORATIVE_JOURNEY_DEFAULTS;
  const sectionSettings={};
  if(c.sectionSettings && typeof c.sectionSettings==='object' && !Array.isArray(c.sectionSettings))for(const id of JOURNEY_SECTION_IDS){
    const value=c.sectionSettings[id];if(!value || typeof value!=='object' || Array.isArray(value))continue;
    sectionSettings[id]={placement:['left','right','bottom'].includes(value.placement)?value.placement:'auto',scale:number(value.scale,60,150,100),accent:number(value.accent,0,100,65),enabled:value.enabled!==false};
  }
  return {
    sectionSettings,
    image:journeyImageUrl(c.image,d.image),secondaryImage:journeyImageUrl(c.secondaryImage),
    backgroundImage:journeyImageUrl(c.backgroundImage,d.backgroundImage),unifyBackground:c.unifyBackground===true,
    path:c.path==='edges'?'edges':'flowing',
    size:number(c.size,60,320,d.size),density:Math.round(number(c.density,8,28,d.density)),
    opacity:number(c.opacity,20,100,d.opacity),depth:number(c.depth,0,100,d.depth),
    mobileSize:number(c.mobileSize,36,150,d.mobileSize),mobileDensity:Math.round(number(c.mobileDensity,4,14,d.mobileDensity)),
    stemVisible:c.stemVisible===true,stemColor:/^#[\da-f]{6}$/i.test(c.stemColor)?c.stemColor:d.stemColor,
  };
}
