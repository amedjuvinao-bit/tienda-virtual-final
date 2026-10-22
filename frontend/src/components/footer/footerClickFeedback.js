// Touch, mouse and keyboard share the same response. Navigation stays native.
const running=new WeakMap();
export function footerClickFeedback(event){
 const root=event.currentTarget,control=event.target.closest?.('a,button');
 if(!control || !root.contains(control) || control.disabled || control.getAttribute('aria-disabled')==='true')return;
 const view=control.ownerDocument.defaultView;
 if(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof control.animate!=='function')return;
 running.get(control)?.forEach(animation=>animation.cancel());
 const textLink=Boolean(control.closest('.footer-ed__links')),css=view.getComputedStyle(control);
 const base=css.transform && css.transform!=='none'?css.transform+' ':'';
 const shadow=css.boxShadow && css.boxShadow!=='none'?css.boxShadow+', ':'';
 const accent=css.getPropertyValue('--fe-accent').trim() || css.color;
 const animations=[control.animate([
  {scale:'1',translate:'0 0',transform:base+'perspective(500px) rotateX(0deg)',offset:0},
  {scale:textLink?'.96':'.84',translate:textLink?'0 0':'0 4px',transform:base+`perspective(500px) rotateX(${textLink?0:18}deg)`,offset:.2},
  {scale:textLink?'1':'1.09',translate:textLink?'0 0':'0 -5px',transform:base+`perspective(500px) rotateX(${textLink?0:-8}deg)`,offset:.55},
  {scale:'1',translate:'0 0',transform:base+'perspective(500px) rotateX(0deg)',offset:1},
 ],{duration:740,easing:'cubic-bezier(.22,.75,.25,1)'})];
 if(!textLink)animations.push(control.animate([
  {boxShadow:shadow+'0 0 0 0 transparent,0 0 0 transparent'},
  {boxShadow:shadow+`0 0 0 8px color-mix(in srgb,${accent} 28%,transparent),0 12px 28px color-mix(in srgb,${accent} 45%,transparent)`,offset:.45},
  {boxShadow:shadow+'0 0 0 15px transparent,0 0 0 transparent'},
 ],{duration:850,easing:'ease-out'}));
 const emblem=control.querySelector('.footer-ed__social-emblem') || control.querySelector('svg:not(.footer-ed__metal-defs)');
 if(emblem)animations.push(emblem.animate([
  {filter:'brightness(1)',rotate:'0deg',scale:'1',translate:'0 0'},
  {filter:'brightness(1.45)',rotate:'-14deg',scale:'1.16',translate:'0 -3px',offset:.38},
  {filter:'brightness(1.1)',rotate:'5deg',scale:'1.04',translate:'0 0',offset:.7},
  {filter:'brightness(1)',rotate:'0deg',scale:'1',translate:'0 0'},
 ],{duration:850,easing:'cubic-bezier(.22,1,.36,1)'}));
 const light=control.querySelector('.footer-ed__press-light > i');
 if(light)animations.push(light.animate([
  {transform:'translateX(-130%)',opacity:0},
  {transform:'translateX(-65%)',opacity:1,offset:.18},
  {transform:'translateX(65%)',opacity:1,offset:.75},
  {transform:'translateX(130%)',opacity:0},
 ],{duration:900,easing:'cubic-bezier(.2,.6,.3,1)'}));
 running.set(control,animations);
 animations.at(-1).onfinish=()=>{if(running.get(control)===animations)running.delete(control);};
}
