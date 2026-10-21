export const FOOTER_EDITORIAL_DEFAULTS = {
  headline: 'Sigamos\nen contacto', description: 'Recibe novedades de nuestra tienda.',
  brandName: 'Tu marca', brandMode: 'text', brandTagline: '',
  newsletterEnabled: true, brandEnabled: true, socialsEnabled: true,
  column1Enabled: true, column2Enabled: true, column3Enabled: true,
  legalEnabled: true, watermarkEnabled: true, backToTopEnabled: true,
  watermarkText: '', backToTopLabel: 'Volver arriba',
  successMessage: '¡Gracias! Recibimos tu suscripción.',
  errorMessage: 'No pudimos guardar tu correo. Intenta de nuevo.',
  backgroundMode: 'satin', backgroundImage: '', backgroundColor: '#f3c4ba',
  backgroundX: 50, backgroundY: 50, backgroundZoom: 100,
  maxWidth: 1400, minHeight: 740, paddingX: 64, paddingTop: 84, paddingBottom: 0,
  contentGap: 64, headlineSize: 76, brandSize: 68, columnTitleSize: 30, bodySize: 16,
  watermarkSize: 205, watermarkOpacity: 70, titleFont: '"Bodoni Moda", Georgia, serif', bodyFont: 'Inter, system-ui, sans-serif',
  headingColor: '#681429', textColor: '#6a4842', accentColor: '#b27342',
  glassTint: '#f3c4ba', edgeColor: '#fff0df', buttonColor: '#8c1738', buttonTextColor: '#ffffff',
  material: 'texture', materialOpacity: 95, glassOpacity: 22, blur: 12, depth: 12, radius: 28,
  socialSize: 70, socialGap: 18, socialIconStyle: 'relief', buttonWidth: 210, buttonHeight: 60,
  mobilePadding: 22, mobileHeadlineSize: 42, mobileBrandSize: 52, mobileWatermarkSize: 92,
  mobileNavigation: 'accordion', hoverMotion: 'lift', animationDuration: 350,
};
const bounds = {
  backgroundX:[0,100], backgroundY:[0,100], backgroundZoom:[100,180],
  maxWidth:[640,2200], minHeight:[0,1400], paddingX:[12,160], paddingTop:[0,180], paddingBottom:[0,120],
  contentGap:[16,120], headlineSize:[28,110], brandSize:[24,100], columnTitleSize:[18,42], bodySize:[12,24],
  watermarkSize:[80,400], watermarkOpacity:[0,90], materialOpacity:[0,100], glassOpacity:[0,80], blur:[0,32], depth:[0,30], radius:[12,50],
  socialSize:[36,90], socialGap:[4,32], buttonWidth:[100,320], buttonHeight:[44,80],
  mobilePadding:[14,40], mobileHeadlineSize:[26,60], mobileBrandSize:[24,64], mobileWatermarkSize:[48,140], animationDuration:[150,1000],
};
export function safeFooterLink(value) {
  if (typeof value !== 'string') return '';
  const text=value.trim();
  if (!text || /[\u0000-\u0020\u007f\\]/.test(text)) return '';
  if (/^\/(?!\/)/.test(text) || /^#[A-Za-z][\w:-]*$/.test(text)) return text;
  try { const url=new URL(text); return !url.username && !url.password && ['https:','http:','mailto:','tel:'].includes(url.protocol) && url.pathname ? text : ''; } catch { return ''; }
}
export function safeFooterImage(value) {
  const url=safeFooterLink(value); return /^https:\/\//i.test(url) || /^\/(?!\/)/.test(url) ? url : '';
}
export function normalizeEditorialOptions(footer = {}) {
  const input=footer.editorial && typeof footer.editorial==='object' ? footer.editorial : {};
  const c={...FOOTER_EDITORIAL_DEFAULTS,...input};
  for(const [key,[min,max]] of Object.entries(bounds)) { const n=Number(c[key]);c[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):FOOTER_EDITORIAL_DEFAULTS[key]; }
  for(const key of ['headingColor','textColor','accentColor','glassTint','edgeColor','buttonColor','buttonTextColor','backgroundColor']) if(!/^#[\da-f]{6}$/i.test(c[key] || '')) c[key]=FOOTER_EDITORIAL_DEFAULTS[key];
  for(const key of ['headline','description','brandName','brandTagline','watermarkText','backToTopLabel','successMessage','errorMessage','titleFont','bodyFont']) c[key]=typeof c[key]==='string'?c[key].slice(0,1000):FOOTER_EDITORIAL_DEFAULTS[key];
  for(const key of Object.keys(FOOTER_EDITORIAL_DEFAULTS).filter(key=>key.endsWith('Enabled'))) c[key]=c[key]!==false;
  const enums={brandMode:['text','image','both'],socialIconStyle:['relief','custom'],backgroundMode:['satin','inherit','color','image'],material:['texture','css'],mobileNavigation:['accordion','open'],hoverMotion:['none','lift','shine','tilt']};
  for(const [key,values] of Object.entries(enums)) if(!values.includes(c[key])) c[key]=FOOTER_EDITORIAL_DEFAULTS[key];
  c.backgroundImage=safeFooterImage(c.backgroundImage);
  // Keep business copy. A legacy logo/icon must not silently replace the model's
  // large editorial signature or sculpted social glyphs; those are explicit choices.
  if(input.description===undefined && typeof footer.subscribeText==='string' && !footer.subscribeText.startsWith('Suscríbete y sé la primera')) c.description=footer.subscribeText;
  return c;
}
const defaults=[
  {title:'Explora',links:[{label:'Nuestra historia',href:'/nuestra-historia'},{label:'Catálogo',href:'/#categorias'}]},
  {title:'Ayuda',links:[{label:'Envíos',href:'/politicas'},{label:'Cambios y devoluciones',href:'/cambios-devoluciones'},{label:'Contacto',href:'/#informacion'}]},
  {title:'Legal',links:[{label:'Privacidad',href:'/privacidad'},{label:'Términos y condiciones',href:'/terminos'}]},
];
export const FOOTER_SOCIALS=[{key:'instagram',label:'Instagram'},{key:'tiktok',label:'TikTok'},{key:'facebook',label:'Facebook'},{key:'whatsapp',label:'WhatsApp'}];
export function footerColumns(footer={}) {
  return defaults.map((item,i)=>({id:'column'+(i+1),title:typeof footer['column'+(i+1)+'Title']==='string'?footer['column'+(i+1)+'Title']:item.title,
    links:(Array.isArray(footer['column'+(i+1)+'Links'])?footer['column'+(i+1)+'Links']:item.links).filter(link=>link && typeof link.label==='string' && link.label.trim() && safeFooterLink(link.href)).map(link=>({...link,href:safeFooterLink(link.href)})),
  }));
}
