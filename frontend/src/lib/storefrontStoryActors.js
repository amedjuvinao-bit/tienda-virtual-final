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
    if(element.closest('.storefront-card-opening,[hidden],dialog,[role="dialog"],[data-story-ignore]'))return;
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

export function actorPresentation(preset,actor,intensity=65,compact=false) {
  const {role,index,geometry:g}=actor, strength=.55+.45*intensity/100, mobile=compact ? .72 : 1;
  const visual=['hero','product','detail'].includes(role), side=index%2?-1:1;
  let x=0,y=24,scale=.98,rotate='0deg',origin='50% 50%';
  if(visual){
    if(preset==='stack'){x=role==='hero'?0:g.fromX*.74;y=role==='hero'?76:Math.max(40,g.fromY);scale=.76;rotate=`1 ${side*.18} 0 ${role==='hero'?58:46}deg`;origin='50% 100%';}
    if(preset==='cinema'){x=role==='hero'?0:side*(80+index*10);y=role==='hero'?-48:24;scale=.82;rotate=`0 1 0 ${side*(role==='hero'?14:28)}deg`;}
    if(preset==='depth'){x=role==='hero'?-45:side*62;y=16;scale=.94;rotate=`0 1 0 ${role==='hero'?52:side*38}deg`;origin=role==='hero'?'0% 50%':side>0?'0% 50%':'100% 50%';}
    if(preset==='cascade'){x=g.fromX;y=Math.max(28,g.fromY);scale=.68;rotate=`${side*(role==='hero'?6:16-index*.7)}deg`;}
  }else if(role==='title'){y=32;scale=1;rotate=preset==='stack'?'1 0 0 18deg':'0deg';origin='50% 100%';}
  else if(role==='signature'){y=20;scale=.97;}
  const from={opacity:0,translate:`${x*strength*mobile}px ${y*strength*mobile}px`,scale:String(1-(1-scale)*strength),rotate,transformOrigin:origin};
  const settle={opacity:1,translate:'0 0',scale:visual?'1.012':'1',rotate:'0deg',transformOrigin:origin,offset:.82};
  const to={opacity:1,translate:'0 0',scale:'1',rotate:'0deg',transformOrigin:origin};
  const delays={eyebrow:120,title:210,copy:340,hero:340,product:440,detail:570,action:760,signature:850};
  const durations={eyebrow:520,title:760,copy:680,hero:1050,product:950,detail:780,action:620,signature:850};
  return {frames:[from,settle,to],delay:(delays[role]??500)+Math.min(index,7)*(preset==='cascade'?95:65),duration:durations[role]??760};
}

export function openingPresentation(preset,part) {
  const first=part==='first';
  const end={opacity:0,transform:'none'};
  if(part==='bed')return [{opacity:.9},{opacity:.65,offset:.35},{opacity:0}];
  if(part==='light')return [{opacity:0,transform:'translateX(-60%)'},{opacity:.55,offset:.4},{opacity:0,transform:'translateX(65%)'}];
  if(preset==='stack')return [{opacity:1,transform:'rotateY(0deg)'},{opacity:.9,offset:.58},{...end,transform:`rotateY(${first?116:-116}deg)`}];
  if(preset==='cinema')return [{opacity:1,transform:'rotateX(0deg)'},{opacity:.9,offset:.5},{...end,transform:'rotateX(-112deg) translateY(-12%)'}];
  if(preset==='depth')return [{opacity:1,transform:'rotateY(0deg)'},{opacity:.9,offset:.6},{...end,transform:'rotateY(118deg)'}];
  return [{opacity:1,transform:'translateY(0) rotateX(0deg)'},{opacity:.85,offset:.5},{...end,transform:`translateY(${first?'-':''}38%) rotateX(${first?-108:108}deg)`}];
}
