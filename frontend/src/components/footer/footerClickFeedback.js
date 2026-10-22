// Click feedback is independent of hover: touch and keyboard activate it too.
// Native navigation, form submission and accordion handlers run immediately.
const running=new WeakMap();
export function footerClickFeedback(event){
 const root=event.currentTarget,control=event.target.closest?.('a,button');
 if(!control || !root.contains(control) || control.disabled || control.getAttribute('aria-disabled')==='true')return;
 const view=control.ownerDocument.defaultView;
 if(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof control.animate!=='function')return;
 const old=running.get(control);old?.forEach(animation=>animation.cancel());
 const textLink=Boolean(control.closest('.footer-ed__links'));
 const press=control.animate([
  {scale:'1',translate:'0 0',offset:0},
  {scale:textLink?'.97':'.9',translate:textLink?'0 0':'0 3px',offset:.18},
  {scale:textLink?'1':'1.035',translate:textLink?'0 0':'0 -1px',offset:.58},
  {scale:'1',translate:'0 0',offset:1},
 ],{duration:480,easing:'cubic-bezier(.22,.75,.25,1)'});
 const animations=[press],emblem=control.querySelector('.footer-ed__social-emblem');
 if(emblem)animations.push(emblem.animate([
  {filter:'brightness(1)',rotate:'0deg'},
  {filter:'brightness(1.3)',rotate:'-5deg',offset:.35},
  {filter:'brightness(1)',rotate:'0deg'},
 ],{duration:600,easing:'cubic-bezier(.22,1,.36,1)'}));
 running.set(control,animations);
 press.onfinish=()=>{if(running.get(control)===animations)running.delete(control);};
}
