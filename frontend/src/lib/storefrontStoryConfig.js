export const STORY_PRESETS = [
  { id: 'stack', name: 'Pop-up escultórico', description: 'Los objetos se levantan sobre su propia base con pliegues tridimensionales, como una tarjeta pop-up.' },
  { id: 'cinema', name: 'Iris de enfoque', description: 'Una apertura circular descubre las imágenes en su sitio; después se revelan el título y la acción.' },
  { id: 'depth', name: 'Trama de imágenes', description: 'Franjas de las imágenes reales se entrelazan y reconstruyen cada pieza. Los reproductores se revelan sin duplicarse.' },
  { id: 'cascade', name: 'Enfoque cinematográfico', description: 'Un primer plano desenfocado retrocede y gana nitidez. La tipografía entra después, como un cambio de foco de cámara.' },
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
