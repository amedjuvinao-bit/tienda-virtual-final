import {afterEach,expect,it,vi} from 'vitest';
import {mountJourneyCurtain} from './storefrontJourneyCurtain';
import {normalizeStoryConfig,STORY_CHAPTER_CHANGE_EVENT} from './storefrontStoryConfig';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});
function fixture(raw={}){
 let clock=0,callback;
 const reduced=new EventTarget(),mobile=new EventTarget();reduced.matches=false;mobile.matches=false;
 vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduced:mobile));
 vi.spyOn(performance,'now').mockImplementation(()=>clock);
 vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{callback=cb;return 1;});
 vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{callback=null;});
 const root=document.createElement('div');root.style.setProperty('--color-bg','#f3d2c8');
 Object.defineProperty(root,'clientWidth',{value:1200});
 root.innerHTML='<div data-journey-curtain-pin><div data-journey-curtain hidden></div></div><section id="banner"><button>Explorar</button><video></video></section><section id="instagram"><h2>Comunidad</h2></section>';
 document.body.append(root);const config=normalizeStoryConfig(raw),stop=mountJourneyCurtain(root,config),curtain=root.querySelector('[data-journey-curtain]');
 const fire=(direction='down',to='instagram')=>root.dispatchEvent(new CustomEvent(STORY_CHAPTER_CHANGE_EVENT,{detail:{from:'banner',to,direction}}));
 const step=time=>{clock=time;const cb=callback;callback=null;cb?.(time);};
 const flush=()=>{for(let i=0;callback&&i<60;i++)step(clock+50);};
 return{root,curtain,stop,fire,step,flush,reduced,mobile};
}
it('uses the configured background image for the whole curved sweep and leaves content in place',()=>{
 const f=fixture({journey:{backgroundImage:'/store/satin.webp'}}),button=f.root.querySelector('button');
 expect(f.curtain.hidden).toBe(true);expect(f.root.dataset.journeyTransition).toBeUndefined();
 f.fire();expect(f.curtain.hidden).toBe(false);expect(f.curtain.style.backgroundImage).toBe('url("/store/satin.webp")');expect(f.curtain.style.backgroundColor).toBe('rgb(243, 210, 200)');
 expect(f.root.dataset.journeyTransition).toBe('cover');expect(f.curtain.style.clipPath).toContain(' C ');
 f.step(800);expect(f.root.dataset.journeyTransition).toBe('reveal');
 expect(f.root.querySelectorAll('video')).toHaveLength(1);expect(button.style.transform).toBe('');expect(f.root.querySelector('section').style.clipPath).toBe('');
 const click=vi.fn();button.addEventListener('click',click);button.dispatchEvent(new Event('pointerdown',{bubbles:true}));button.click();
 expect(click).toHaveBeenCalledOnce();expect(f.curtain.hidden).toBe(true);f.stop();
});
it('reuses an inherited backdrop, reverses direction and never queues delayed extra sweeps',()=>{
 const f=fixture();f.root.style.setProperty('--journey-shared-image','url("/another-business.webp")');f.fire('up');
 expect(f.curtain.style.backgroundImage).toBe('url("/another-business.webp")');expect(f.curtain.dataset.direction).toBe('up');
 f.step(350);const path=f.curtain.style.clipPath;f.fire('down','footer');expect(f.curtain.style.clipPath).toBe(path);
 f.flush();expect(f.curtain.hidden).toBe(true);expect(f.root.dataset.journeyTransition).toBeUndefined();
 const calls=requestAnimationFrame.mock.calls.length;f.flush();expect(requestAnimationFrame).toHaveBeenCalledTimes(calls);
 f.fire();expect(f.curtain.hidden).toBe(false);f.stop();expect(f.curtain.getAttribute('style')).toBeNull();
 f.fire();expect(f.curtain.hidden).toBe(true);
});
it('respects reduced motion, disabled mobile and the separate entrances mode',()=>{
 const f=fixture({mobileMode:'off'});f.fire();f.reduced.matches=true;f.reduced.dispatchEvent(new Event('change'));
 expect(f.curtain.hidden).toBe(true);f.fire();expect(f.curtain.hidden).toBe(true);
 f.reduced.matches=false;f.mobile.matches=true;f.fire();expect(f.curtain.hidden).toBe(true);f.stop();
 const separate=fixture({experience:'entrances'});separate.fire();expect(separate.curtain.hidden).toBe(true);separate.stop();
});
it('uses the target section backdrop when there is no shared background and supports preview viewports',()=>{
 const f=fixture();f.stop();f.root.querySelector('#instagram').style.backgroundImage='url("/section-art.webp")';
 const viewport=document.createElement('div');Object.defineProperty(viewport,'clientHeight',{value:340});
 const stop=mountJourneyCurtain(f.root,normalizeStoryConfig({}),{scroller:viewport,mobileOverride:true});f.fire();
 expect(f.curtain.style.backgroundImage).toBe('url("/section-art.webp")');expect(f.curtain.style.height).toBe('340px');
 f.root.querySelector('button').focus();expect(f.curtain.hidden).toBe(true);stop();
});
