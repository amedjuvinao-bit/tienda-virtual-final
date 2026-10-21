import { afterEach, expect, it, vi } from 'vitest';
import { mountDecorativeJourney } from './decorativeJourney';
import { normalizeStoryConfig } from './storefrontStoryConfig';
import { journeyTextVisibility } from './decorativeJourneyGeometry';
import { normalizeDecorativeJourney } from './decorativeJourneyConfig';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(raw={},options={}){
  let y=0,frame;
  const reduce=new EventTarget(),mobile=new EventTarget();reduce.matches=false;mobile.matches=false;
  vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduce:mobile));
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frame=callback;return 1;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const root=document.createElement('div');
  root.innerHTML='<div data-journey-pin><svg data-journey-world><mask data-journey-mask>'+Array.from({length:8},()=>'<rect data-journey-occluder/>').join('')+'</mask><path data-journey-stem/><g data-journey-ornaments>'+Array.from({length:28},(_,i)=>`<g data-journey-piece="${i}"><image href="/test-resource.webp"/></g>`).join('')+'</g></svg></div><section data-story-top="0"><button>Explorar</button><video></video></section><section data-story-top="800"><h2>Segunda sección</h2><iframe></iframe></section><section data-story-top="2400"><h2>Final</h2></section>';
  Object.defineProperty(root,'offsetWidth',{value:1200});
  [...root.querySelectorAll('section')].forEach(node=>Object.defineProperty(node,'offsetHeight',{value:800}));
  root.querySelector('[data-journey-world]').getBoundingClientRect=()=>({top:0,left:0,width:1200,height:800});
  root.querySelector('button').getBoundingClientRect=()=>({top:600-y,left:450,right:650,bottom:650-y,width:200,height:50});
  document.body.append(root);
  const stop=mountDecorativeJourney(root,normalizeStoryConfig({...raw,journey:{image:'/test-resource.webp',...raw.journey}}),options);
  const flush=()=>{const cb=frame;frame=null;cb?.();};
  const scroll=top=>{y=top;window.dispatchEvent(new Event('scroll'));flush();};
  return {root,reduce,mobile,stop,flush,scroll};
}
it('mantiene los mismos adornos al cruzar secciones y revierte exactamente el camino al subir',()=>{
  const f=fixture(),pieces=[...f.root.querySelectorAll('[data-journey-piece]')];
  const initial=pieces.map(node=>node.getAttribute('transform'));
  f.scroll(920);expect(pieces.map(node=>node.getAttribute('transform'))).not.toEqual(initial);
  f.scroll(1600);expect([...f.root.querySelectorAll('[data-journey-piece]')].every((node,i)=>node===pieces[i])).toBe(true);
  f.scroll(0);expect(pieces.map(node=>node.getAttribute('transform'))).toEqual(initial);
  expect(f.root.querySelectorAll('[data-journey-pin]')).toHaveLength(1);f.stop();
});
it('oculta visualmente el adorno detrás de los controles sin duplicar contenido ni reproductores',()=>{
  const f=fixture(),mask=f.root.querySelector('[data-journey-occluder]');
  expect(Number(mask.getAttribute('x'))).toBeLessThan(450);expect(Number(mask.getAttribute('width'))).toBeGreaterThan(200);
  expect(f.root.querySelectorAll('video')).toHaveLength(1);expect(f.root.querySelectorAll('iframe')).toHaveLength(1);
  const click=vi.fn();f.root.querySelector('button').addEventListener('click',click);f.root.querySelector('button').click();expect(click).toHaveBeenCalledOnce();f.stop();
});
it('adapta la cantidad en móvil, congela el recorrido con movimiento reducido y permite apagarlo',()=>{
  const f=fixture({journey:{density:24,mobileDensity:6}}),visible=()=>[...f.root.querySelectorAll('[data-journey-piece]')].filter(node=>Number(node.getAttribute('opacity'))>0);
  expect(visible()).toHaveLength(24);f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();expect(visible()).toHaveLength(6);
  f.reduce.matches=true;f.reduce.dispatchEvent(new Event('change'));f.flush();const pose=visible()[0].getAttribute('transform');f.scroll(1200);expect(visible()[0].getAttribute('transform')).toBe(pose);f.stop();
  const off=fixture({mobileMode:'off'});off.mobile.matches=true;off.mobile.dispatchEvent(new Event('change'));off.flush();expect(off.root.dataset.journeyActive).toBe('false');expect(off.root.dataset.journeyShared).toBe('false');off.stop();
});
it('no deja un bucle de cuadros activo ni eventos después de desmontarse',()=>{
  const f=fixture();expect(requestAnimationFrame).not.toHaveBeenCalled();f.scroll(800);expect(requestAnimationFrame).toHaveBeenCalledOnce();f.stop();
  window.dispatchEvent(new Event('scroll'));expect(requestAnimationFrame).toHaveBeenCalledOnce();expect(f.root.dataset.journeyActive).toBeUndefined();
});
it('limita la carga visual y rechaza imágenes con protocolos que no son de imagen',()=>{
  const c=normalizeDecorativeJourney({density:999,mobileDensity:999,size:999,image:'javascript:alert(1)',backgroundImage:'data:text/html,test',stemColor:'red'});
  expect(c).toMatchObject({density:28,mobileDensity:14,size:320,image:'',backgroundImage:'',stemColor:''});
});

it('empieza sin recursos de un negocio y conserva los fondos de cada sección',()=>{
  expect(normalizeDecorativeJourney()).toMatchObject({image:'',secondaryImage:'',backgroundImage:'',unifyBackground:false,stemVisible:false,stemColor:''});
  const f=fixture({journey:{image:''}});
  expect(f.root.dataset.journeyActive).toBe('false');expect(f.root.dataset.journeyShared).toBe('false');
  expect(f.root.querySelector('[data-journey-stem]').getAttribute('d')).toBeNull();f.stop();
});
it('permite elegir solo un fondo compartido o solo la línea sin imágenes obligatorias',()=>{
  const background=fixture({journey:{image:'',unifyBackground:true,backgroundImage:'/store-background.webp'}});
  expect(background.root.dataset.journeyActive).toBe('false');expect(background.root.dataset.journeyShared).toBe('true');background.stop();
  const line=fixture({journey:{image:'',stemVisible:true}});
  expect(line.root.dataset.journeyActive).toBe('true');expect(line.root.querySelector('[data-journey-stem]').getAttribute('d')).toBeTruthy();
  expect([...line.root.querySelectorAll('[data-journey-piece]')].every(node=>node.getAttribute('opacity')==='0')).toBe(true);line.stop();
});
it('mantiene los recursos de cada tienda y no restaura imágenes al quitarlas',()=>{
  const first=normalizeDecorativeJourney({image:'/first-store.webp',backgroundImage:'/first-background.webp',stemVisible:true,stemColor:'#1286aa',unifyBackground:true});
  const second=normalizeDecorativeJourney({image:'https://cdn.example.test/second-store.png'});
  expect(first).toMatchObject({image:'/first-store.webp',backgroundImage:'/first-background.webp',stemColor:'#1286aa',unifyBackground:true});
  expect(second).toMatchObject({image:'https://cdn.example.test/second-store.png',backgroundImage:'',stemVisible:false,unifyBackground:false});
  expect(normalizeDecorativeJourney({...first,image:'',backgroundImage:''})).toMatchObject({image:'',backgroundImage:''});
});

it('conserva los adornos nítidos a máxima profundidad y adapta la sombra en móvil',()=>{
  const f=fixture({journey:{depth:100}}),pieces=[...f.root.querySelectorAll('[data-journey-piece]')],art=f.root.querySelector('[data-journey-ornaments]');
  const initialScales=pieces.map(node=>node.getAttribute('transform'));
  for(const y of [0,300,1200,2300]){
    f.scroll(y);
    expect(pieces.every(node=>!node.style.filter)).toBe(true);
    expect(art.style.filter).toBe('drop-shadow(0 10px 7px rgb(0 0 0 / .14))');
  }
  expect(pieces.map(node=>node.getAttribute('transform'))).not.toEqual(initialScales);
  f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();
  expect(art.style.filter).toBe('drop-shadow(0 6px 4.2px rgb(0 0 0 / .14))');
  expect(pieces.every(node=>!node.style.filter)).toBe(true);f.stop();
});

it('protege los títulos con una desaparición completa y gradual, sin cortes dentro del adorno',()=>{
  const boxes=[{x:100,y:100,width:200,height:50}];
  expect(journeyTextVisibility(200,125,30,boxes)).toBe(0);
  expect(journeyTextVisibility(65,125,30,boxes)).toBeCloseTo(.25);
  expect(journeyTextVisibility(60,125,30,boxes)).toBeCloseTo(.5);
  expect(journeyTextVisibility(50,125,30,boxes)).toBe(1);
  expect(journeyTextVisibility(200,125,30,[])).toBe(1);
});
