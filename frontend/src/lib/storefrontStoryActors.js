import { actorGeometry } from './storefrontSceneGeometry';

// Semantic roles keep the presentation attached to real business content.
// Dedicated markers take precedence; selectors cover the existing layouts.
const roles={
  eyebrow:'.categories-fan__eyebrow,.look-editorial__eyebrow,.ig-journal__profile,.tk-stage__identity,.tk-stage__intro>.tk-brand,.info-glass-eyebrow',
  title:'.trending-section__heading,.trending-runway__heading,h1,h2',
  copy:'.categories-fan__subtitle,.look-editorial__intro>p,.complementos-banner__subtitle,.tk-stage__subtitle,.ig-journal__subtitle,.footer-ed__invitation>p,header>p',
  hero:'.look-editorial__hero,.complementos-look-image,.ig-journal__main,.tk-stage__hero,.trending-runway__gallery,.footer-ed__brand',
  product:'.look-editorial__card-surface,.categories-fan__category,.ig-journal__previews>article,.tk-stage__items>article,.info-glass-card,.info-responsive-card',
  detail:'.ig-journal__highlights>button,.footer-ed__column h3,.footer-ed__social',
  action:'.complementos-look-button,.tk-stage__follow,.ig-journal__follow,.trending-runway__details,.footer-ed__newsletter',
  signature:'.footer-ed__watermark',
};
const rank={eyebrow:0,title:1,copy:2,hero:3,product:4,detail:5,action:6,signature:7};
export function collectStoryActors(surface,viewport) {
  const view=surface.ownerDocument.defaultView, candidates=new Map();
  const add=(element,role)=>{
    if(element.closest('[data-story-fragments],[hidden],dialog,[role="dialog"],[data-story-ignore]'))return;
    const css=view.getComputedStyle(element),rect=element.getBoundingClientRect();
    if(css.display==='none'||css.visibility==='hidden'||rect.width<2||rect.height<2)return;
    if(!candidates.has(element))candidates.set(element,role);
  };
  surface.querySelectorAll('[data-story-actor]').forEach(el=>add(el,el.dataset.storyActor));
  Object.entries(roles).forEach(([role,selector])=>surface.querySelectorAll(selector).forEach(el=>add(el,role)));
  surface.querySelectorAll('article,figure').forEach(el=>{if(!el.matches('.keen-slider__slide'))add(el,'product');});
  if(![...candidates.values()].some(role=>['hero','product'].includes(role)))surface.querySelectorAll('picture,img,video').forEach(el=>{const r=el.getBoundingClientRect();if(r.width>=100&&r.height>=80)add(el,'hero');});
  surface.querySelectorAll('[data-story-action]').forEach(el=>add(el,'action'));
  if(![...candidates.values()].includes('action'))surface.querySelectorAll('a,button').forEach(el=>{if(!el.closest('nav,[role="tablist"],.ig-journal__actions,.tk-stage__pages') && el.getBoundingClientRect().width>=80)add(el,'action');});
  const selected=[...candidates].filter(([el])=>{for(let p=el.parentElement;p && p!==surface;p=p.parentElement)if(candidates.has(p))return false;return true;});
  const counts={};
  return selected.sort((a,b)=>(rank[a[1]]??5)-(rank[b[1]]??5)).slice(0,32).map(([element,role])=>({element,role,index:counts[role]=(counts[role]??-1)+1,geometry:actorGeometry(element,surface,surface.offsetWidth || surface.getBoundingClientRect().width,viewport)}));
}

// Each preset owns a different rendering mechanism and its own sequence.
// Saved preset IDs stay stable; there are no shared directional entrance frames.
export function actorPresentation(preset,actor,intensity=65,compact=false) {
  const {role,index}=actor;
  const strength=(.55+.45*intensity/100)*(compact ? .78 : 1);
  const visual=['hero','product','detail','signature'].includes(role);
  const stagger=Math.min(index,7);
  if(preset==='cinema') {
    // An iris reveals the content in place. No translation, tilt or flying cards.
    const frames=visual
      ? [{clipPath:'circle(0% at 50% 50%)',opacity:1},{clipPath:'circle(76% at 50% 50%)',opacity:1}]
      : [{clipPath:'inset(0 0 100% 0)',opacity:1},{clipPath:'inset(0 0 0% 0)',opacity:1}];
    const delays={eyebrow:70,hero:100,product:330,title:440,copy:570,detail:680,action:940,signature:700};
    return {mechanism:'iris',frames,delay:(delays[role]??400)+stagger*110,duration:visual?1000+intensity*5:650,easing:'cubic-bezier(.65,0,.25,1)'};
  }
  if(preset==='depth') {
    // The image is rebuilt by independently cropped strips of its own pixels.
    // Other objects stay in place; text appears after the image assembles.
    const delays={eyebrow:0,title:90,hero:180,product:400,copy:800,detail:600,action:1130,signature:900};
    return {mechanism:'weave',fragments:visual,frames:visual
      ? [{opacity:1},{opacity:1}]
      : [{opacity:0},{opacity:1}],delay:(delays[role]??450)+stagger*100,duration:visual?1450:540,easing:'linear'};
  }
  if(preset==='cascade') {
    // An optical rack focus and macro pull-back, with no position or rotation.
    const blur=(visual?19:8)*strength, zoom=visual?1+.25*strength:1;
    const delays={hero:0,product:150,eyebrow:340,title:460,copy:650,detail:460,action:1050,signature:700};
    return {mechanism:'focus',frames:[
      {opacity:visual ? .25 : 0,scale:String(zoom),filter:`blur(${blur}px) saturate(.65) contrast(.85)`},
      {opacity:1,scale:String(1+(zoom-1)*.12),filter:'blur(0px) saturate(1) contrast(1)',offset:.76},
      {opacity:1,scale:'1',filter:'blur(0px) saturate(1) contrast(1)'},
    ],delay:(delays[role]??400)+stagger*130,duration:visual?1700:900,easing:'cubic-bezier(.22,.65,.25,1)'};
  }
  const origin=visual?'50% 100%':'50% 50%';
  const angle=(visual?78:role==='title'?55:25)*strength;
  const delays={eyebrow:0,title:110,copy:300,hero:210,product:410,detail:610,action:850,signature:700};
  return {mechanism:'fold',frames:[
    {opacity:0,rotate:`1 0 0 ${angle}deg`,scale:String(visual ? .82 : 1),transformOrigin:origin},
    {opacity:1,rotate:'1 0 0 -3deg',scale:'1',transformOrigin:origin,offset:.8},
    {opacity:1,rotate:'1 0 0 0deg',scale:'1',transformOrigin:origin},
  ],delay:(delays[role]??400)+stagger*95,duration:visual?1250:750,easing:'cubic-bezier(.2,.65,.2,1)'};
}
