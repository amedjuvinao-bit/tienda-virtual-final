// Touch, mouse and keyboard share the same response. Social links leave after the visible press.
const running=new WeakMap(),pendingLinks=new WeakMap(),replaying=new WeakSet();
export function footerClickFeedback(event){
 const root=event.currentTarget,control=event.target.closest?.('a,button');
 if(!control || !root.contains(control) || control.disabled || control.getAttribute('aria-disabled')==='true')return;
 if(replaying.has(control) || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button>0)return;
 const view=control.ownerDocument.defaultView;
 if(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof control.animate!=='function')return;
 const pending=pendingLinks.get(control);if(pending){view.clearTimeout(pending);pendingLinks.delete(control);}
 running.get(control)?.forEach(animation=>animation.cancel());
 const textLink=Boolean(control.closest('.footer-ed__links')),css=view.getComputedStyle(control);
 const base=css.transform && css.transform!=='none'?css.transform+' ':'';
 const animations=[control.animate([
  {scale:'1',translate:'0 0',transform:base+'perspective(500px) rotateX(0deg)',offset:0},
  {scale:textLink?'.96':'.84',translate:textLink?'0 0':'0 4px',transform:base+`perspective(500px) rotateX(${textLink?0:18}deg)`,offset:.2},
  {scale:textLink?'1':'1.09',translate:textLink?'0 0':'0 -5px',transform:base+`perspective(500px) rotateX(${textLink?0:-8}deg)`,offset:.55},
  {scale:'1',translate:'0 0',transform:base+'perspective(500px) rotateX(0deg)',offset:1},
 ],{duration:740,easing:'cubic-bezier(.22,.75,.25,1)'})];
 const emblem=control.querySelector('.footer-ed__social-emblem') || control.querySelector('svg:not(.footer-ed__metal-defs)');
 if(emblem)animations.push(emblem.animate([
  {rotate:'0deg',scale:'1',translate:'0 0'},
  {rotate:'-8deg',scale:'1.12',translate:'0 -3px',offset:.38},
  {rotate:'3deg',scale:'1.04',translate:'0 0',offset:.7},
  {rotate:'0deg',scale:'1',translate:'0 0'},
 ],{duration:850,easing:'cubic-bezier(.22,1,.36,1)'}));
 const light=control.querySelector('.footer-ed__press-light > i');
 if(light)animations.push(light.animate([
  {transform:'translateX(-130%)',opacity:0},
  {transform:'translateX(-65%)',opacity:1,offset:.18},
  {transform:'translateX(65%)',opacity:1,offset:.75},
  {transform:'translateX(130%)',opacity:0},
 ],{duration:900,easing:'cubic-bezier(.2,.6,.3,1)'}));
 const wave=control.querySelector('.footer-ed__press-light > b');
 if(wave)animations.push(wave.animate([
  {transform:'scale(.35)',opacity:0},
  {transform:'scale(.72)',opacity:.95,offset:.28},
  {transform:'scale(1.12)',opacity:.65,offset:.65},
  {transform:'scale(1.55)',opacity:0},
 ],{duration:950,easing:'cubic-bezier(.18,.65,.3,1)'}));
 running.set(control,animations);
 if(control.matches('a.footer-ed__social')){
  event.preventDefault();
  pendingLinks.set(control,view.setTimeout(()=>{
   pendingLinks.delete(control);
   animations.forEach(animation=>animation.finish());
   if(running.get(control)===animations)running.delete(control);
   if(!control.isConnected)return;
   // Replay only the native link action, never the animation. If transient
   // activation expired, use the same tab rather than risking a blocked popup.
   const target=control.getAttribute('target'),fallback=target==='_blank' && !view.navigator.userActivation?.isActive;
   if(fallback)control.setAttribute('target','_self');
   replaying.add(control);
   try{control.click();}finally{
    replaying.delete(control);
    if(fallback)control.setAttribute('target',target);
   }
  },620));
 }
 animations.at(-1).onfinish=()=>{if(running.get(control)===animations)running.delete(control);};
}
