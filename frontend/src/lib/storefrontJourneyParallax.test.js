import {afterEach,expect,it,vi} from 'vitest';
import {journeyLayerPose,mountJourneyParallax} from './storefrontJourneyParallax';

afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals();});

function fixture(config={},options={}){
  let y=0,clock=0,id=0;const queue=new Map();
  const reduced=new EventTarget(),mobile=new EventTarget();reduced.matches=false;mobile.matches=false;
  vi.stubGlobal('matchMedia',vi.fn(query=>query.includes('reduced')?reduced:mobile));
  vi.spyOn(performance,'now').mockImplementation(()=>clock);
  vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
  vi.spyOn(document.documentElement,'scrollHeight','get').mockReturnValue(2800);
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{queue.set(++id,cb);return id;});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(key=>queue.delete(key));
  const root=document.createElement('div');Object.defineProperty(root,'clientWidth',{value:1200});root.getBoundingClientRect=()=>({top:-y,left:0,width:1200,height:2800});
  const heights=[800,1500,500],tops=[0,800,2300];
  root.innerHTML=heights.map((height,index)=>`<section id="${index?'scene-'+index:'banner'}" data-story-top="${tops[index]}"><div class="storefront-chapter-surface"><h2 data-story-actor="title">Título</h2><figure data-story-actor="hero" style="transform:rotate(1deg)"><video></video><button>Ver detalle</button></figure><article data-story-actor="product">Segunda pieza</article></div></section>`).join('');
  const nodes=[...root.children];
  nodes.forEach((node,index)=>{
    Object.defineProperty(node,'offsetHeight',{get:()=>heights[index]});node.getBoundingClientRect=()=>({top:Math.max(tops[index]-y,Math.min(0,800-heights[index])),left:0,width:1200,height:heights[index]});
    const surface=node.firstChild;surface.getBoundingClientRect=node.getBoundingClientRect;Object.defineProperty(surface,'offsetWidth',{value:1200});
    node.querySelectorAll('[data-story-actor]').forEach(el=>{
      const role=el.dataset.storyActor,top=role==='title'?40:role==='hero'?200:index===1?1100:350,width=role==='hero'?500:240,height=role==='hero'?280:80;
      for(const[key,value]of Object.entries({offsetTop:top,offsetLeft:150,offsetWidth:width,offsetHeight:height,offsetParent:surface}))Object.defineProperty(el,key,{value});
      el.getBoundingClientRect=()=>({top:node.getBoundingClientRect().top+top,left:150,width,height});
    });
  });
  document.body.append(root);const stop=mountJourneyParallax(root,config,options);
  const step=(dt=16)=>{clock+=dt;const callbacks=[...queue.values()];queue.clear();callbacks.forEach(cb=>cb(clock));};
  const flush=()=>{for(let i=0;queue.size&&i<200;i++)step(25);};
  const scroll=top=>{y=top;if(options.scroller)options.scroller.scrollTop=top;(options.scroller || window).dispatchEvent(new Event('scroll'));step();};
  return{root,nodes,stop,step,flush,scroll,reduced,mobile,queue};
}

it('moves photographs and type on different planes, settles once, and preserves real media and layout',()=>{
  const f=fixture(),chapter=f.nodes[1],hero=chapter.querySelector('figure'),title=chapter.querySelector('h2');
  expect(f.root.dataset.journeyParallax).toBe('true');expect(f.nodes[0].querySelector('figure').style.translate).toBe('');
  f.scroll(300);expect(hero.style.translate).not.toBe(title.style.translate);expect(hero.style.translate).toContain('calc(');
  expect(hero.style.transform).toBe('rotate(1deg)');expect(hero.style.opacity).toBe('');expect(f.root.querySelectorAll('video')).toHaveLength(3);
  f.scroll(800);f.flush();expect(hero.style.translate).toBe('');expect(title.style.translate).toBe('');expect(f.queue.size).toBe(0);
  expect(chapter.offsetHeight).toBe(1500);expect(chapter.dataset.storyTop).toBe('800');expect(chapter.style.getPropertyValue('--story-pin-top')).toBe('-700px');
  f.scroll(1900);f.flush();expect(hero.style.translate).not.toBe('');f.scroll(800);f.flush();expect(hero.style.translate).toBe('');f.stop();
});

it('keeps a pointer gesture stable and finishes the interactive chapter after the click',()=>{
  const f=fixture(),hero=f.nodes[1].querySelector('figure'),button=hero.querySelector('button'),click=vi.fn();
  f.scroll(300);const before=hero.style.translate;button.addEventListener('click',click);
  button.dispatchEvent(new Event('pointerdown',{bubbles:true}));f.step(40);expect(hero.style.translate).toBe(before);
  window.dispatchEvent(new Event('pointerup'));button.click();expect(click).toHaveBeenCalledOnce();f.flush();expect(hero.style.translate).toBe('');f.stop();
});

it('does not cancel the parallax when a touch starts on the section to scroll the page',()=>{
  const f=fixture(),chapter=f.nodes[1],hero=chapter.querySelector('figure');
  f.scroll(300);chapter.dispatchEvent(new Event('pointerdown',{bubbles:true}));
  f.scroll(1900);window.dispatchEvent(new Event('pointerup'));f.flush();
  expect(hero.style.translate).not.toBe('');f.stop();
});

it('reveals deep content in a long section and finishes short last sections at the scroll limit',()=>{
  const f=fixture(),deep=f.nodes[1].querySelector('article');
  expect(deep.style.translate).toBe('');f.scroll(1500);expect(deep.style.translate).not.toBe('');f.flush();
  f.scroll(2000);f.flush();expect(f.nodes[2].querySelector('figure').style.translate).toBe('');expect(f.nodes[2].querySelector('article').style.translate).toBe('');f.stop();
});

it('keeps completed sticky sections covered instead of exposing their old cards through the shared background',()=>{
  const f=fixture({journey:{unifyBackground:true}});f.scroll(2000);f.flush();
  expect(f.nodes[0].firstChild.style.clipPath).toContain('100%');
  expect(f.nodes[1].firstChild.style.clipPath).toContain('inset(');
  f.scroll(0);f.flush();expect(f.nodes[0].firstChild.style.clipPath).toBe('');
  f.stop();expect(f.nodes.every(node=>node.firstChild.style.clipPath==='')).toBe(true);
});

it('supports the panel viewport and restores original transforms and properties on cleanup',()=>{
  const viewport=document.createElement('div');Object.defineProperty(viewport,'clientHeight',{value:340});Object.defineProperty(viewport,'scrollHeight',{value:2800});viewport.getBoundingClientRect=()=>({top:45});
  const f=fixture({}, {scroller:viewport,mobileOverride:true});f.scroll(600);f.flush();
  expect(f.root.dataset.journeyParallax).toBe('true');f.stop();
  expect(f.root.dataset.journeyParallax).toBeUndefined();expect(f.root.querySelector('[data-journey-layer]')).toBeNull();
  expect(f.nodes.every(node=>node.style.getPropertyValue('--story-pin-top')==='')).toBe(true);
  expect(f.nodes[1].querySelector('figure').style.transform).toBe('rotate(1deg)');expect(f.nodes[1].querySelector('figure').style.translate).toBe('');
  viewport.dispatchEvent(new Event('scroll'));expect(f.queue.size).toBe(0);
});

it('respects motion preferences, the disabled mobile mode and the separate entrance effects',()=>{
  const f=fixture({mobileMode:'off'});f.scroll(300);f.reduced.matches=true;f.reduced.dispatchEvent(new Event('change'));f.flush();
  expect(f.root.dataset.journeyParallax).toBeUndefined();expect(f.root.querySelector('[data-journey-layer]')).toBeNull();
  f.reduced.matches=false;f.mobile.matches=true;f.reduced.dispatchEvent(new Event('change'));f.flush();expect(f.root.dataset.journeyParallax).toBeUndefined();f.stop();
  for(const config of[{enabled:false},{experience:'entrances'}]){const disabled=fixture(config);expect(disabled.root.dataset.journeyParallax).toBeUndefined();disabled.stop();}
});

it('lands exactly on the saved layout and adapts travel without fading, resizing or turning the images',()=>{
  const frame={width:1200,height:800,entrance:.4,handoff:.1};
  const hero=journeyLayerPose({role:'hero'},frame),type=journeyLayerPose({role:'title'},frame),mobile=journeyLayerPose({role:'hero'},{...frame,compact:true});
  expect(hero).not.toEqual(type);expect(Math.abs(mobile.x)).toBeLessThan(Math.abs(hero.x));
  for(const role of['hero','title','product','detail','action']){const pose=journeyLayerPose({role},{width:1200,height:800});expect(pose.x).toBeCloseTo(0);expect(pose.y).toBeCloseTo(0);}
});
