import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountStorefrontSectionMotion, storefrontSectionTop } from './storefrontSectionMotion';
import { normalizeStoryConfig, storySectionOrder, storyVisual } from './storefrontStoryConfig';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(config={}) {
  let y=0, heights=[800,2000,800], frame;
  const reduce=new EventTarget(), mobile=new EventTarget();reduce.matches=false;mobile.matches=false;
  vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduce:mobile));
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
  vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(document.documentElement,'scrollHeight','get').mockImplementation(()=>heights.reduce((a,b)=>a+b,0));
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frame=callback;return 1;});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const root=document.createElement('div');
  root.getBoundingClientRect=()=>({top:-y});
  root.innerHTML=heights.map((_,i)=>`<section id="chapter-${i}"><div class="storefront-chapter-surface"><h2>Capítulo ${i}</h2><article>Imagen</article><button>Explorar</button></div></section>`).join('');
  const animations=[];
  [...root.children].forEach((node,index)=>{
    Object.defineProperty(node,'offsetHeight',{get:()=>heights[index]});
    node.getBoundingClientRect=()=>({top:heights.slice(0,index).reduce((a,b)=>a+b,0)-y,height:heights[index]});
    node.querySelectorAll('*').forEach(element=>{element.animate=()=>{const a={pause:vi.fn(),cancel:vi.fn(),effect:{updateTiming:vi.fn()},currentTime:0};animations.push(a);return a;};});
  });
  document.body.append(root);
  const stop=mountStorefrontSectionMotion(root,config);
  const flush=()=>{const callback=frame;frame=null;callback?.();};
  const scroll=top=>{y=top;window.dispatchEvent(new Event('scroll'));flush();};
  return {root,nodes:[...root.children],reduce,mobile,stop,flush,scroll,animations,heights};
}
describe('recorrido global de la tienda',()=>{
  it('normaliza preferencias guardadas y respeta el orden del contenido sin duplicarlo',()=>{
    expect(normalizeStoryConfig({preset:'bad',intensity:999,pace:'bad',mobileMode:'bad',enabled:false})).toEqual({enabled:false,preset:'stack',intensity:100,pace:'balanced',mobileMode:'adapted'});
    expect(normalizeStoryConfig({intensity:'no'}).intensity).toBe(65);
    expect(storySectionOrder([{id:'tiktok'},{id:'categorias'},{id:'tiktok'},{id:'unknown'}]).slice(0,3)).toEqual(['tiktok','categorias','tendencia']);
  });
  it('ofrece cuatro resultados distintos y deja el contenido completamente abierto al terminar la entrada',()=>{
    const styles=['stack','cinema','depth','cascade'].map(id=>storyVisual(id,.2,.3));
    expect(new Set(styles.map(style=>JSON.stringify(style))).size).toBe(4);
    for(const id of ['cinema','depth','cascade'])expect(storyVisual(id,1,0)).toMatchObject({transform:'none',opacity:1,clip:'none'});
  });
  it.each(['stack','cinema','depth','cascade'])('mantiene la puesta en escena de %s hasta que termina de entrar y la libera al leer',preset=>{
    const f=fixture({preset});
    f.scroll(350);
    expect(f.nodes[1].firstChild.style.transform).not.toBe('none');
    const heading=f.animations[3];
    expect(heading.currentTime).toBeLessThan(1000);
    f.scroll(900);
    expect(f.nodes[1].firstChild.style.transform).toBe('none');
    expect(heading.effect.updateTiming).toHaveBeenLastCalledWith({fill:'none'});
    f.scroll(350);
    expect(heading.effect.updateTiming).toHaveBeenLastCalledWith({fill:'both'});
    f.stop();
    expect(f.nodes[1].firstChild.style.getPropertyValue('--story-edge')).toBe('');
  });
  it.each(['stack','cinema','depth','cascade'])('termina el efecto de %s aunque el footer sea más corto que la pantalla',preset=>{
    const f=fixture({preset});f.heights[2]=300;
    window.dispatchEvent(new Event('resize'));f.flush();f.scroll(2300);
    expect(f.nodes[2].firstChild.style.transform).toBe('none');
    expect(f.nodes[2].firstChild.style.clipPath).toBe('none');
    expect(f.nodes[2].firstChild.style.opacity).toBe('1');f.stop();
  });
  it('coordina avance y regreso y conserva las coordenadas de las secciones largas',()=>{
    const f=fixture();
    expect(f.root.dataset.storyPreset).toBe('stack');
    expect(f.nodes[0].dataset.sectionMotion).toBe('entering');
    expect(f.nodes[1].style.getPropertyValue('--story-pin-top')).toBe('-1200px');
    expect(storefrontSectionTop(f.nodes[2])).toBe(2800);
    f.scroll(800);expect(f.nodes[1].dataset.sectionDirection).toBe('down');
    expect(f.nodes[0].dataset.sectionMotion).toBe('leaving');
    f.scroll(0);expect(f.nodes[0].dataset.sectionDirection).toBe('up');
    expect(storefrontSectionTop(f.nodes[2])).toBe(2800);
    f.heights[1]=2600;window.dispatchEvent(new Event('resize'));f.flush();
    expect(storefrontSectionTop(f.nodes[2])).toBe(3400);
    expect(f.nodes[1].offsetHeight).toBe(2600);f.stop();
  });
  it('retira los efectos al cambiar movimiento reducido y los recupera sin duplicar listeners',()=>{
    const f=fixture({preset:'depth'});f.scroll(100);
    expect(f.nodes[1].firstChild.style.transform).toContain('perspective');
    f.reduce.matches=true;f.reduce.dispatchEvent(new Event('change'));f.flush();
    expect(f.root.dataset.storyPreset).toBeUndefined();
    expect(f.nodes[1].firstChild.style.transform).toBe('');
    expect(f.animations.every(a=>a.cancel.mock.calls.length===1)).toBe(true);
    f.reduce.matches=false;f.reduce.dispatchEvent(new Event('change'));f.flush();
    expect(f.root.dataset.storyPreset).toBe('depth');f.stop();
    expect(f.nodes[1].dataset.storyTop).toBeUndefined();
    expect(f.nodes[1].firstChild.style.transform).toBe('');
    f.scroll(1200);expect(f.root.dataset.storyPreset).toBeUndefined();
  });
  it('permite apagar solo el movimiento móvil sin apagar la versión de escritorio',()=>{
    const f=fixture({mobileMode:'off'});
    f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();
    expect(f.root.dataset.storyPreset).toBeUndefined();
    f.mobile.matches=false;f.mobile.dispatchEvent(new Event('change'));f.flush();
    expect(f.root.dataset.storyPreset).toBe('stack');f.stop();
  });
  it.each(['stack','cinema','depth','cascade'])('pausa los videos y TikTok al quedar cubiertos en %s',preset=>{
    const f=fixture({preset});
    const video=document.createElement('video');Object.defineProperty(video,'paused',{value:false});video.pause=vi.fn();
    const frame=document.createElement('iframe');frame.src='https://www.tiktok.com/player/v1/7000000000000000001';
    f.nodes[0].firstChild.append(video,frame);
    const message=vi.spyOn(frame.contentWindow,'postMessage').mockImplementation(()=>{});
    f.scroll(850);
    expect(f.nodes[0].dataset.storyVisible).toBe('false');
    expect(video.pause).toHaveBeenCalledOnce();
    expect(message).toHaveBeenCalledWith({'x-tiktok-player':true,type:'pause'},'https://www.tiktok.com');
    f.scroll(0);expect(f.nodes[0].dataset.storyVisible).toBe('true');f.stop();
  });
});
