export const STORY_PRESETS = [
  { id: 'stack', name: 'Tarjeta desplegable', description: 'Se abren dos hojas de cristal; la imagen se levanta y las piezas salen del pliegue hacia su lugar.' },
  { id: 'cinema', name: 'Escaparate en capas', description: 'Una tapa se eleva y presenta primero la pieza principal, después los detalles y la invitación a explorar.' },
  { id: 'depth', name: 'Álbum editorial', description: 'La cubierta abre desde un lateral; las imágenes y los textos componen una página con profundidad.' },
  { id: 'cascade', name: 'Composición en abanico', description: 'La tarjeta se despliega y sus piezas se separan desde un punto común hasta formar la composición.' },
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
