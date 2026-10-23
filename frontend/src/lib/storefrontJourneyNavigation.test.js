import { afterEach, expect, it, vi } from 'vitest';
import { animateJourneyTo, journeyDuration } from './storefrontJourneyNavigation';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
function journey(){
  let y=0,frame,time=0;
  const preference=new EventTarget();preference.matches=false;
  vi.stubGlobal('matchMedia',()=>preference);
  vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
  vi.spyOn(document.documentElement,'scrollHeight','get').mockReturnValue(5000);
  vi.spyOn(window,'scrollTo').mockImplementation(({top})=>{y=top;});
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{frame=fn;return 1;});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{frame=null;});
  const element=document.createElement('section');element.dataset.storyTop='1600';document.body.append(element);
  const next=()=>{const callback=frame;frame=null;callback?.(time);time+=100;};
  const finish=()=>{for(let i=0;i<50&&frame;i++)next();};
  return {element,next,finish,preference,y:()=>y};
}
it('conduce el ritmo, permite posiciones intermedias y corrige la llegada si una imagen cambia el inicio',()=>{
  const f=journey(),done=vi.fn();
  animateJourneyTo(f.element,{pace:'balanced',offset:80,onFinish:done});
  f.next();for(let i=0;i<6;i++)f.next();
  expect(f.y()).toBeGreaterThan(0);expect(f.y()).toBeLessThan(1520);
  f.element.dataset.storyTop='1800';f.finish();
  expect(f.y()).toBe(1720);expect(done).toHaveBeenCalledExactlyOnceWith(true);
  expect(window.scrollTo).toHaveBeenLastCalledWith({top:1720,behavior:'instant'});
});
it.each(['touchstart','wheel','pointerdown'])('libera el control al recibir %s y no retoma el viaje',event=>{
  const f=journey(),done=vi.fn();animateJourneyTo(f.element,{onFinish:done});f.next();f.next();
  const at=f.y();window.dispatchEvent(new Event(event));f.finish();
  expect(f.y()).toBe(at);expect(done).toHaveBeenCalledExactlyOnceWith(false);
});
it('respeta movimiento reducido y no añade un recorrido tras la llegada instantánea',()=>{
  const f=journey(),done=vi.fn();f.preference.matches=true;
  animateJourneyTo(f.element,{onFinish:done});expect(f.y()).toBe(1600);
  f.finish();expect(done).toHaveBeenCalledExactlyOnceWith(true);
});
it('termina inmediatamente si se activa movimiento reducido durante el viaje',()=>{
  const f=journey(),done=vi.fn();animateJourneyTo(f.element,{onFinish:done});f.next();
  f.preference.matches=true;f.preference.dispatchEvent(new Event('change'));f.finish();
  expect(f.y()).toBe(1600);expect(done).toHaveBeenCalledExactlyOnceWith(true);
});
it('limita el destino al final real de la página y responde al ritmo elegido',()=>{
  const f=journey();f.element.dataset.storyTop='4900';animateJourneyTo(f.element,{instant:true});
  expect(f.y()).toBe(4200);
  expect(journeyDuration(800,800,'quick')).toBeLessThan(journeyDuration(800,800,'balanced'));
  expect(journeyDuration(800,800,'balanced')).toBeLessThan(journeyDuration(800,800,'leisurely'));
});
