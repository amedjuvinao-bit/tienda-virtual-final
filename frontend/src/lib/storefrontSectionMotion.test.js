import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountStorefrontSectionMotion, storefrontSectionTop } from './storefrontSectionMotion';
import { normalizeStoryConfig, storySectionOrder } from './storefrontStoryConfig';
import { actorPresentation, openingPresentation } from './storefrontStoryActors';

const originalAnimate=Element.prototype.animate;
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();if(originalAnimate)Element.prototype.animate=originalAnimate;else delete Element.prototype.animate;});
function fixture(config={}) {
  let y=0, heights=[800,2000,300], frame;
  const reduce=new EventTarget(),mobile=new EventTarget();reduce.matches=false;mobile.matches=false;
  vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduce:mobile));
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(document.documentElement,'scrollHeight','get').mockImplementation(()=>heights.reduce((a,b)=>a+b,0));
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frame=callback;return 1;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const animations=[];
  Element.prototype.animate=function(frames,options){
    const animation={element:this,frames,options,playState:'running',currentTime:0,onfinish:null,effect:{updateTiming:vi.fn()},pause:vi.fn(function(){this.playState='paused';}),play:vi.fn(function(){this.playState='running';}),cancel:vi.fn(function(){this.playState='idle';}),finish(){this.playState='finished';this.onfinish?.();}};
    animations.push(animation);return animation;
  };
  const root=document.createElement('div');root.className='storefront-sections';root.getBoundingClientRect=()=>({top:-y,left:0,width:1200});
  root.innerHTML=heights.map((_,i)=>`<section id="${i===0?'banner':'chapter-'+i}"><div class="storefront-chapter-surface"><h2 data-story-actor="title">Capítulo ${i}</h2><p data-story-actor="copy">Descripción</p><figure data-story-actor="hero"><article><img alt="Imagen real"/><button>Ver foto</button></article></figure><article data-story-actor="product">Producto A</article><article data-story-actor="product">Producto B</article><div data-story-actor="detail">Detalle</div><button data-story-actor="action">Explorar</button><div data-story-actor="signature">Última pieza</div><div class="storefront-card-opening"><span class="storefront-card-opening__bed"></span><span data-leaf="first"></span><span data-leaf="second"></span><span class="storefront-card-opening__light"></span></div></div></section>`).join('');
  [...root.children].forEach((node,index)=>{
    const top=()=>heights.slice(0,index).reduce((a,b)=>a+b,0);
    Object.defineProperty(node,'offsetHeight',{get:()=>heights[index]});Object.defineProperty(node,'offsetWidth',{value:1200});
    node.getBoundingClientRect=()=>({top:top()-y,left:0,width:1200,height:heights[index]});
    const surface=node.firstChild;surface.getBoundingClientRect=node.getBoundingClientRect;Object.defineProperty(surface,'offsetWidth',{value:1200});
    const positions={title:40,copy:100,hero:180,product:500,detail:540,action:650,signature:1800};
    node.querySelectorAll('[data-story-actor]').forEach(element=>{
      const actorTop=positions[element.dataset.storyActor], width=element.dataset.storyActor==='hero'?550:180,height=element.dataset.storyActor==='hero'?300:50;
      element.getBoundingClientRect=()=>({top:top()-y+actorTop,left:150,width,height});
      Object.defineProperty(element,'offsetParent',{value:surface});Object.defineProperty(element,'offsetTop',{value:actorTop});Object.defineProperty(element,'offsetLeft',{value:150});Object.defineProperty(element,'offsetWidth',{value:width});Object.defineProperty(element,'offsetHeight',{value:height});
    });
  });
  document.body.append(root);const stop=mountStorefrontSectionMotion(root,config);
  const flush=()=>{const callback=frame;frame=null;callback?.();};
  const scroll=top=>{y=top;window.dispatchEvent(new Event('scroll'));flush();};
  const finishVisible=()=>animations.filter(a=>a.playState==='running').forEach(a=>a.finish());
  return {root,nodes:[...root.children],reduce,mobile,stop,flush,scroll,animations,heights,finishVisible};
}
describe('presentaciones globales por objetos',()=>{
  it('conserva los cuatro identificadores y los ajustes guardados',()=>{
    expect(normalizeStoryConfig({preset:'bad',intensity:999,pace:'bad',mobileMode:'bad',enabled:false})).toEqual({enabled:false,preset:'stack',intensity:100,pace:'balanced',mobileMode:'adapted'});
    expect(storySectionOrder([{id:'tiktok'},{id:'categorias'},{id:'tiktok'}]).slice(0,3)).toEqual(['tiktok','categorias','tendencia']);
  });
  it.each(['stack','cinema','depth','cascade'])('abre %s y presenta título, pieza principal y acción sin transformar la sección',preset=>{
    const f=fixture({preset});f.scroll(800);
    const chapter=f.nodes[1];expect(chapter.dataset.storyStage).toBe('opening');
    expect(f.animations.some(a=>a.element===chapter.firstChild)).toBe(false);
    expect(chapter.firstChild.style.transform).toBe('');expect(chapter.firstChild.style.clipPath).toBe('');
    const actors=f.animations.filter(a=>a.element.closest('#chapter-1')&&a.id.startsWith('story:')&&!a.id.startsWith('story:cover:'));
    const timing=role=>actors.find(a=>a.id.startsWith('story:'+role+':')).options.delay;
    expect(timing('title')).toBeLessThan(timing('hero'));expect(timing('hero')).toBeLessThan(timing('action'));
    expect(actors.filter(a=>a.id.startsWith('story:product:'))).toHaveLength(2);
    f.finishVisible();expect(chapter.dataset.storyStage).toBe('presented');
    expect(chapter.hasAttribute('data-story-performing')).toBe(false);
    expect(actors.filter(a=>a.id.startsWith('story:hero:')).every(a=>a.cancel.mock.calls.length===1)).toBe(true);
    f.stop();
  });
  it('usa los objetos una sola vez y respeta el banner y los controles contenidos en la foto principal',()=>{
    const f=fixture();expect(f.animations.some(a=>a.element.closest('#banner'))).toBe(false);
    const primary=f.nodes[1].querySelector('figure');
    expect(f.animations.filter(a=>a.element===primary)).toHaveLength(1);
    expect(f.animations.some(a=>a.element===primary.querySelector('button'))).toBe(false);
    f.scroll(800);f.scroll(0);expect(f.animations.some(a=>a.element.closest('#banner'))).toBe(false);f.stop();
  });
  it('termina la presentación aunque no se siga desplazando y espera a las piezas fuera de pantalla',()=>{
    const f=fixture();f.scroll(800);f.finishVisible();
    const chapter=f.nodes[1],tail=f.animations.find(a=>a.element===chapter.querySelector('[data-story-actor="signature"]'));
    expect(tail.playState).toBe('paused');
    const covers=f.animations.filter(a=>a.id.startsWith('story:cover:')).length;
    vi.spyOn(performance,'now').mockReturnValue(performance.now()+1200);
    f.scroll(1900);expect(tail.play).toHaveBeenCalledOnce();expect(tail.effect.updateTiming).toHaveBeenCalled();
    f.finishVisible();expect(f.animations.filter(a=>a.id.startsWith('story:cover:'))).toHaveLength(covers);f.stop();
  });
  it('mantiene los anclajes y permite leer una sección larga completa',()=>{
    const f=fixture();expect(storefrontSectionTop(f.nodes[2])).toBe(2800);
    f.scroll(1300);expect(f.nodes[1].offsetHeight).toBe(2000);expect(f.nodes[1].style.getPropertyValue('--story-pin-top')).toBe('-1200px');
    f.heights[1]=2600;window.dispatchEvent(new Event('resize'));f.flush();expect(storefrontSectionTop(f.nodes[2])).toBe(3400);f.stop();
  });
  it('conserva una presentación en curso cuando una imagen o un texto provoca una medición',async()=>{
    const f=fixture();f.scroll(800);const hero=f.animations.find(a=>a.element===f.nodes[1].querySelector('figure'));
    const count=f.animations.length;f.nodes[1].querySelector('figure').append(document.createTextNode('Detalle cargado'));
    await Promise.resolve();f.flush();expect(f.animations).toHaveLength(count);expect(hero.cancel).not.toHaveBeenCalled();f.stop();
  });
  it('deja utilizar un botón inmediatamente y libera todos los efectos al recibir foco',()=>{
    const f=fixture();f.scroll(800);const button=f.nodes[1].querySelector('[data-story-actor="action"]');
    button.focus();expect(f.nodes[1].dataset.storyStage).toBe('ready');
    const click=vi.fn();button.addEventListener('click',click);button.click();expect(click).toHaveBeenCalledOnce();
    expect(f.animations.filter(a=>a.element.closest('#chapter-1')).every(a=>a.playState==='idle')).toBe(true);f.stop();
  });
  it('vuelve a abrir la tarjeta al regresar a su cabecera, sin repetirla mientras se lee',()=>{
    const f=fixture();f.scroll(800);f.finishVisible();const before=f.animations.length;
    f.scroll(1100);expect(f.animations).toHaveLength(before);
    f.scroll(2850);f.scroll(720);expect(f.nodes[1].dataset.storyStage).toBe('opening');expect(f.animations.length).toBeGreaterThan(before);f.stop();
  });
  it('respeta movimiento reducido, permite apagarlo en móvil y limpia los efectos',()=>{
    const f=fixture({mobileMode:'off'});f.scroll(800);
    f.reduce.matches=true;f.reduce.dispatchEvent(new Event('change'));f.flush();expect(f.root.dataset.storyPreset).toBeUndefined();
    f.reduce.matches=false;f.reduce.dispatchEvent(new Event('change'));f.flush();expect(f.root.dataset.storyPreset).toBe('stack');
    f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();expect(f.root.dataset.storyPreset).toBeUndefined();
    f.stop();expect(f.nodes[1].dataset.storyTop).toBeUndefined();expect(f.animations.every(a=>a.playState==='idle')).toBe(true);
  });
  it('da un desarrollo diferente a los objetos y a las hojas de cada modelo',()=>{
    const actor={role:'hero',index:0,geometry:{fromX:150,fromY:80}};
    const modes=['stack','cinema','depth','cascade'];
    expect(new Set(modes.map(id=>JSON.stringify(actorPresentation(id,actor).frames))).size).toBe(4);
    expect(new Set(modes.map(id=>JSON.stringify(openingPresentation(id,'first')))).size).toBe(4);
  });
  it('pausa videos y TikTok al quedar la sección cubierta, sin duplicar reproductores',()=>{
    const f=fixture();const video=document.createElement('video');Object.defineProperty(video,'paused',{value:false});video.pause=vi.fn();
    const frame=document.createElement('iframe');frame.src='https://www.tiktok.com/player/v1/7000000000000000001';f.nodes[0].firstChild.append(video,frame);
    const message=vi.spyOn(frame.contentWindow,'postMessage').mockImplementation(()=>{});f.scroll(850);
    expect(video.pause).toHaveBeenCalledOnce();expect(message).toHaveBeenCalledWith({'x-tiktok-player':true,type:'pause'},'https://www.tiktok.com');expect(f.root.querySelectorAll('iframe')).toHaveLength(1);f.stop();
  });
});
