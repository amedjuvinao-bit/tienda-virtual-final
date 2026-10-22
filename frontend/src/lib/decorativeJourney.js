import { journeyScene } from './decorativeJourneyScenes';
import { journeyArtworkLayout, applyJourneyArtworkLayout } from './decorativeJourneyArtwork';
import { cinematicOrnament, cinematicBeat, advanceCinematicCamera } from './decorativeJourneyCinema';

export function mountDecorativeJourney(container,config,{scroller=null,mobileOverride}={}){
  const view=container.ownerDocument.defaultView,doc=container.ownerDocument,world=container.querySelector('[data-journey-world]');
  if(!world)return ()=>{};
  const c=config.journey,reduce=view.matchMedia?.('(prefers-reduced-motion: reduce)'),mobile=view.matchMedia?.('(max-width:767px)');
  // Capture the store's existing artwork before shared-surface CSS hides local layers.
  // No business-specific image or colour is introduced by the journey.
  const backgroundNodes=[...container.querySelectorAll('.trending-section--floating-glass,.look-editorial,.complementos-look-section,.categories-fan__background,.ig-journal,.tk-stage,.info-glass,.footer-ed,.story-preview__content')];
  const previousShared=container.dataset.journeyShared;
  delete container.dataset.journeyShared;
  let inheritedBackground='none';
  for(const node of backgroundNodes){
    const candidates=[view.getComputedStyle(node).backgroundImage];
    if(!/jsdom/i.test(view.navigator.userAgent))candidates.unshift(view.getComputedStyle(node,'::before').backgroundImage);
    const image=candidates.find(value=>value && value.includes('url('));
    if(image){inheritedBackground=image;break;}
  }
  if(previousShared!==undefined)container.dataset.journeyShared=previousShared;
  if(!c.backgroundImage)container.style.setProperty('--journey-shared-image',inheritedBackground);
  const target=scroller || view,pieces=[...world.querySelectorAll('[data-journey-piece]')];
  const cameras=pieces.map(()=>({position:null,velocity:0}));
  const stem=world.querySelector('[data-journey-stem]'),trace=world.querySelector('[data-journey-trace]');
  const ornaments=world.querySelector('[data-journey-ornaments]');
  const artworkProbes=[];
  let frame=0,dirty=true,disposed=false,chapters=[],width=0,height=0,movingUntil=0,displayPhase=null,cameraVelocity=0,lastPaint=0,ornamentCount=0;
  const scroll=()=>scroller?scroller.scrollTop:view.scrollY;
  const compact=()=>typeof mobileOverride==='boolean'?mobileOverride:Boolean(mobile?.matches);
  function measure(){
    const previousWidth=width;
    width=container.offsetWidth || container.getBoundingClientRect().width;height=scroller?scroller.clientHeight:view.innerHeight;
    if(Math.abs(width-previousWidth)>1){displayPhase=null;for(const camera of cameras){camera.position=null;camera.velocity=0;}}
    const y=scroll(),base=scroller?scroller.getBoundingClientRect().top:0;
    chapters=[...container.children].filter(node=>node.tagName==='SECTION' && node.offsetHeight>0).map(node=>{
      const saved=Number(node.dataset.storyTop);
      return {id:node.dataset.journeySection || node.id,top:node.dataset.storyTop!==undefined && Number.isFinite(saved)?saved:node.getBoundingClientRect().top+y-base,height:node.offsetHeight};
    });
    world.setAttribute('viewBox',`0 0 ${width} ${height}`);
    world.style.height=height+'px';dirty=false;
    const adapted=compact() && config.mobileMode==='adapted',previewScale=scroller?Math.min(1,width/(compact()?390:1440)):1;
    const density=adapted?c.mobileDensity:c.density;
    ornamentCount=adapted?(density>=12?6:4):(density>=20?6:4);
  }
  function paint(){
    frame=0;if(disposed)return;
    const enabled=config.enabled && config.experience==='journey' && !(compact() && config.mobileMode==='off');
    const active=enabled && Boolean(c.image || c.secondaryImage || c.stemVisible);
    container.dataset.journeyActive=String(active);container.dataset.journeyShared=String(enabled && c.unifyBackground);if(!active)return;
    if(dirty)measure();if(width<1 || height<1)return;
    const adapted=compact() && config.mobileMode==='adapted',previewScale=scroller?Math.min(1,width/(compact()?390:1440)):1;
    const origin=world.getBoundingClientRect(),scene=journeyScene(scroll(),chapters,height,width,{...c,intensity:config.intensity,compact:compact(),originTop:origin.top},reduce?.matches);
    const desired=reduce?.matches?0:scene.index+(scene.nextId?scene.progress:Math.min(scene.progress,.7));
    const now=view.performance.now(),dt=Math.min(34,Math.max(1,now-lastPaint));lastPaint=now;
    let settling=false;
    if(displayPhase===null || reduce?.matches){displayPhase=desired;cameraVelocity=0;}
    else {
      const camera=advanceCinematicCamera(displayPhase,cameraVelocity,desired,dt);
      displayPhase=camera.position;cameraVelocity=camera.velocity;
      settling=Math.abs(desired-displayPhase)>.0001 || Math.abs(cameraVelocity)>.001;
      if(!settling){displayPhase=desired;cameraVelocity=0;}
    }
    // All scene styling follows the same smoothed timeline as the scenery.
    // It must not jump to the destination while ornaments are still arriving.
    const last=chapters.at(-1),maxScroll=Math.max(0,last?last.top+last.height-height:0);
    const stops=chapters.map(chapter=>Math.max(0,Math.min(maxScroll,chapter.top-height*.18)));
    const visualIndex=Math.max(0,Math.min(chapters.length-1,Math.floor(displayPhase)));
    const visualScroll=(stops[visualIndex]||0)+Math.max(0,displayPhase-visualIndex)*Math.max(0,(stops[visualIndex+1]??maxScroll)-(stops[visualIndex]||0));
    const visualScene=journeyScene(visualScroll,chapters,height,width,{...c,intensity:config.intensity,compact:compact(),originTop:origin.top},reduce?.matches);
    const size=(adapted?c.mobileSize:c.size)*previewScale*visualScene.scale;
    const count=ornamentCount;
    const depth=c.depth/100,shadowScale=previewScale*(adapted ? .6 : 1);
    if(ornaments)ornaments.style.filter=`drop-shadow(0 ${(3+depth*5)*shadowScale}px ${(3+depth*3)*shadowScale}px rgb(0 0 0 / .14))`;
    const presence=Math.sin(visualScene.accent*Math.PI/2)*visualScene.opacity;
    const opacity=c.opacity/100*presence;
    if(stem)stem.style.opacity='0';if(trace)trace.style.opacity='0';
    pieces.forEach((piece,i)=>{
      if(i>=count || !(c.image || c.secondaryImage)){piece.setAttribute('opacity','0');return;}
      const aspect=Number(piece.dataset.journeyAspect)||1;
      const targetPhase=cinematicBeat(Math.max(0,desired-i*.06)).position,camera=cameras[i];
      if(camera.position===null || reduce?.matches){camera.position=targetPhase;camera.velocity=0;}
      else{
        const next=advanceCinematicCamera(camera.position,camera.velocity,targetPhase,dt);
        camera.position=next.position;camera.velocity=next.velocity;
        if(Math.abs(targetPhase-camera.position)>.0001 || Math.abs(camera.velocity)>.001)settling=true;
        else{camera.position=targetPhase;camera.velocity=0;}
      }
      const pose=cinematicOrnament(i,{phase:desired,cameraPhase:camera.position,width,height,size,aspect,depth,compact:compact(),intensity:config.intensity,count});
      const settings=c.sectionSettings || {};
      const sideWeight=id=>{const side=settings[id]?.placement;return side==='left'?(i%2?.15:1):side==='right'?(i%2?1:.15):1;};
      const emphasis=sideWeight(visualScene.id)*(1-visualScene.handoff)+sideWeight(visualScene.nextId)*visualScene.handoff;
      const {x,y,scale,angle}=pose;
      piece.dataset.journeyBent='false';
      const artwork=piece.querySelector('[data-journey-rigid]');
      if(artwork){
        artwork.style.transformBox='fill-box';artwork.style.transformOrigin='center';
        artwork.style.transform=`perspective(700px) rotateY(${pose.tiltY.toFixed(2)}deg) rotateX(${pose.tiltX.toFixed(2)}deg) translateZ(${pose.lift.toFixed(2)}px)`;
        artwork.style.filter=`drop-shadow(${(pose.shadowX*previewScale).toFixed(2)}px ${(pose.shadowY*previewScale).toFixed(2)}px ${(pose.shadowBlur*previewScale).toFixed(2)}px rgb(0 0 0 / .2)) brightness(${pose.light.toFixed(3)})`;
      }
      piece.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${scale.toFixed(3)})`);
      // Layering protects the content. Scroll never hides the whole ornament
      // or cuts rectangular holes around text, logos, photos or controls.
      piece.setAttribute('opacity',String(opacity*pose.opacity*emphasis));
    });
    container.dataset.journeyPhase=displayPhase.toFixed(4);container.dataset.journeySection=scene.id;container.dataset.journeyHandoff=scene.handoff.toFixed(4);container.dataset.journeySettled=String(!settling);
    if(settling || view.performance.now()<movingUntil)schedule();
  }
  function schedule(){if(!disposed && !frame)frame=view.requestAnimationFrame(paint);}
  function resize(){dirty=true;schedule();}
  function transition(event){if(!event.target.closest?.('[data-journey-pin]')){movingUntil=view.performance.now()+850;schedule();}}
  // Read intrinsic dimensions once per URL, including independently sized
  // secondary artwork. A metadata reload cannot revive a removed resource.
  for(const piece of pieces)applyJourneyArtworkLayout(piece,journeyArtworkLayout(1,1));
  for(const source of new Set(pieces.map(piece=>piece.querySelector('image')?.getAttribute('href')).filter(Boolean))){
    const image=new view.Image();artworkProbes.push(image);
    const loaded=()=>{
      if(disposed || !image.naturalWidth || !image.naturalHeight)return;
      const layout=journeyArtworkLayout(image.naturalWidth,image.naturalHeight);
      for(const piece of pieces)if(piece.querySelector('image')?.getAttribute('href')===source)applyJourneyArtworkLayout(piece,layout);
      resize();
    };
    image.onload=loaded;image.src=source;if(image.complete)loaded();
  }
  const resizeObserver=view.ResizeObserver?new view.ResizeObserver(resize):null;resizeObserver?.observe(container);if(scroller)resizeObserver?.observe(scroller);
  const mutation=new view.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('[data-journey-pin]')))resize();});mutation.observe(container,{childList:true,subtree:true});
  target.addEventListener('scroll',schedule,{passive:true});view.addEventListener('resize',resize);container.addEventListener('transitionrun',transition,true);container.addEventListener('load',resize,true);reduce?.addEventListener?.('change',resize);mobile?.addEventListener?.('change',resize);paint();
  return ()=>{
    disposed=true;for(const image of artworkProbes)image.onload=null;if(frame)view.cancelAnimationFrame(frame);resizeObserver?.disconnect();mutation.disconnect();target.removeEventListener('scroll',schedule);view.removeEventListener('resize',resize);container.removeEventListener('load',resize,true);container.removeEventListener('transitionrun',transition,true);reduce?.removeEventListener?.('change',resize);mobile?.removeEventListener?.('change',resize);
    for(const key of ['journeyActive','journeyShared','journeyPhase','journeySection','journeyHandoff','journeySettled'])delete container.dataset[key];
  };
}
