import { afterEach, expect, it, vi } from 'vitest';
import { mountDecorativeJourney } from './decorativeJourney';
import { normalizeStoryConfig } from './storefrontStoryConfig';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StorefrontDecorativeJourney from '../components/StorefrontDecorativeJourney';
import { normalizeDecorativeJourney } from './decorativeJourneyConfig';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(raw={},options={}){
  let y=0,frame,clock=0;
  vi.spyOn(window.performance,'now').mockImplementation(()=>clock);
  const reduce=new EventTarget(),mobile=new EventTarget();reduce.matches=false;mobile.matches=false;
  vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduce:mobile));
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frame=callback;return 1;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  const root=document.createElement('div');
  const config=normalizeStoryConfig({...raw,journey:{image:'/test-resource.webp',...raw.journey}});
  root.innerHTML=renderToStaticMarkup(createElement(StorefrontDecorativeJourney,{config:config.journey}))+'<section id="banner" data-story-top="0"><button>Explorar</button><video></video></section><section id="instagram" data-story-top="800"><h2>Segunda sección</h2><iframe></iframe></section><section id="footer" data-story-top="2400"><h2>Final</h2></section>';
  Object.defineProperty(root,'offsetWidth',{value:1200});
  [...root.querySelectorAll('section')].forEach(node=>Object.defineProperty(node,'offsetHeight',{value:800}));
  root.querySelector('[data-journey-world]').getBoundingClientRect=()=>({top:0,left:0,width:1200,height:800});
  root.querySelector('button').getBoundingClientRect=()=>({top:600-y,left:450,right:650,bottom:650-y,width:200,height:50});
  document.body.append(root);
  const stop=mountDecorativeJourney(root,config,options);
  const flush=()=>{for(let i=0;frame && i<140;i++){const cb=frame;frame=null;clock+=16;cb(clock);}};
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
it('adapta el camino completo en móvil, congela el recorrido con movimiento reducido y permite apagarlo',()=>{
  const f=fixture({journey:{density:24,mobileDensity:6}}),visible=()=>[...f.root.querySelectorAll('[data-journey-piece]')].filter(node=>Number(node.getAttribute('opacity'))>0);
  const desktopCount=visible().length;expect(desktopCount).toBeGreaterThan(1);f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();expect(visible().length).toBeGreaterThan(1);expect(visible().length).toBeLessThan(desktopCount);
  f.reduce.matches=true;f.reduce.dispatchEvent(new Event('change'));f.flush();const pose=visible()[0].getAttribute('transform');f.scroll(1200);expect(visible()[0].getAttribute('transform')).toBe(pose);f.stop();
  const off=fixture({mobileMode:'off'});off.mobile.matches=true;off.mobile.dispatchEvent(new Event('change'));off.flush();expect(off.root.dataset.journeyActive).toBe('false');expect(off.root.dataset.journeyShared).toBe('false');off.stop();
});
it('no deja un bucle de cuadros activo ni eventos después de desmontarse',()=>{
  const f=fixture();expect(requestAnimationFrame).not.toHaveBeenCalled();f.scroll(800);expect(requestAnimationFrame).toHaveBeenCalled();
  const settledCalls=requestAnimationFrame.mock.calls.length;expect(f.root.dataset.journeySettled).toBe('true');f.flush();expect(requestAnimationFrame).toHaveBeenCalledTimes(settledCalls);f.stop();
  window.dispatchEvent(new Event('scroll'));expect(requestAnimationFrame).toHaveBeenCalledTimes(settledCalls);expect(f.root.dataset.journeyActive).toBeUndefined();
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
it('comparte el fondo sin adornos y descarta las líneas de configuraciones antiguas',()=>{
  const f=fixture({journey:{image:'',unifyBackground:true,backgroundImage:'/store-background.webp'}});
  expect(f.root.dataset.journeyShared).toBe('true');f.stop();
  expect(normalizeDecorativeJourney({image:'/art.png',stemVisible:true,trailLine:true})).toMatchObject({stemVisible:false,trailLine:false,unifyBackground:true});
  expect(normalizeDecorativeJourney({image:'/art.png',backgroundMode:'individual'}).unifyBackground).toBe(false);
});
it('mantiene los recursos de cada tienda y no restaura imágenes al quitarlas',()=>{
  const first=normalizeDecorativeJourney({image:'/first-store.webp',backgroundImage:'/first-background.webp',stemVisible:true,stemColor:'#1286aa',unifyBackground:true});
  const second=normalizeDecorativeJourney({image:'https://cdn.example.test/second-store.png'});
  expect(first).toMatchObject({image:'/first-store.webp',backgroundImage:'/first-background.webp',stemColor:'#1286aa',unifyBackground:true});
  expect(second).toMatchObject({image:'https://cdn.example.test/second-store.png',backgroundImage:'',stemVisible:false,unifyBackground:true});
  expect(normalizeDecorativeJourney({...first,image:'',backgroundImage:''})).toMatchObject({image:'',backgroundImage:''});
});

it('conserva los adornos nítidos a máxima profundidad y adapta la sombra en móvil',()=>{
  const f=fixture({journey:{depth:100}}),pieces=[...f.root.querySelectorAll('[data-journey-piece]')],art=f.root.querySelector('[data-journey-ornaments]');
  const initialScales=pieces.map(node=>node.getAttribute('transform'));
  for(const y of [0,300,1200,2300]){
    f.scroll(y);
    expect(pieces.every(node=>!node.style.filter)).toBe(true);
    expect(art.style.filter).toBe('drop-shadow(0 8px 6px rgb(0 0 0 / .14))');
  }
  expect(pieces.map(node=>node.getAttribute('transform'))).not.toEqual(initialScales);
  f.mobile.matches=true;f.mobile.dispatchEvent(new Event('change'));f.flush();
  expect(art.style.filter).toBe('drop-shadow(0 4.8px 3.5999999999999996px rgb(0 0 0 / .14))');
  expect(pieces.every(node=>!node.style.filter)).toBe(true);f.stop();
});

it('recupera varios adornos y traza la misma curva al avanzar y volver',()=>{
  const f=fixture(),pieces=[...f.root.querySelectorAll('[data-journey-piece]')],stem=f.root.querySelector('[data-journey-stem]'),trace=f.root.querySelector('[data-journey-trace]');
  const initial=stem.getAttribute('d'),offset=trace.getAttribute('stroke-dashoffset');
  expect(pieces).toHaveLength(28);expect(Number(stem.style.opacity)).toBe(0);
  expect(pieces.filter(p=>+p.getAttribute('opacity')>0).length).toBeGreaterThan(1);
  f.scroll(800);expect(stem.getAttribute('d')).not.toBe(initial);expect(trace.getAttribute('stroke-dashoffset')).not.toBe(offset);
  expect(trace.getAttribute('d')).toBe(stem.getAttribute('d'));
  f.scroll(0);expect(stem.getAttribute('d')).toBe(initial);expect(trace.getAttribute('stroke-dashoffset')).toBe(offset);f.stop();
});
it('muestra la línea con los recursos guardados y conserva la decisión de apagarla',()=>{
  const restored=normalizeDecorativeJourney({image:'/store-art.png',stemVisible:false});
  expect(restored.stemVisible).toBe(false);
  const off=normalizeDecorativeJourney({...restored,trailLine:false,stemVisible:false});
  expect(normalizeDecorativeJourney(off).stemVisible).toBe(false);
  expect(normalizeDecorativeJourney().stemVisible).toBe(false);
});
it('loads each artwork aspect independently and releases its metadata callbacks',()=>{
  const probes=[];
  vi.spyOn(window,'Image').mockImplementation(function(){const image={complete:false,naturalWidth:0,naturalHeight:0,onload:null};probes.push(image);return image;});
  const f=fixture({journey:{secondaryImage:'/wide-resource.webp'}});
  expect(probes).toHaveLength(2);
  Object.assign(probes[0],{naturalWidth:600,naturalHeight:1800});probes[0].onload();
  Object.assign(probes[1],{naturalWidth:1800,naturalHeight:600});probes[1].onload();f.flush();
  const tall=f.root.querySelector('[data-journey-piece="0"]'),wide=f.root.querySelector('[data-journey-piece="1"]');
  const dimensions=node=>{const image=node.querySelector('image');return Number(image.getAttribute('height'))/Number(image.getAttribute('width'));};
  expect(dimensions(tall)).toBeCloseTo(3);expect(dimensions(wide)).toBeCloseTo(1/3);
  expect(tall.dataset.journeyAxis).toBe('90');expect(wide.dataset.journeyAxis).toBe('0');
  expect(tall.dataset.journeyBent).toBe('true');expect(wide.dataset.journeyBent).toBe('true');
  expect(tall.querySelector('[data-journey-rigid]').style.display).toBe('none');
  const mapped=[...f.root.querySelectorAll('[data-journey-mesh-part]')];expect(mapped.length).toBeGreaterThan(0);
  expect(mapped.every(part=>part.getAttribute('transform')?.startsWith('matrix('))).toBe(true);
  const layout=tall.querySelector('image').outerHTML;f.scroll(1000);expect(tall.querySelector('image').outerHTML).toBe(layout);
  f.stop();expect(probes.every(image=>image.onload===null)).toBe(true);
});
