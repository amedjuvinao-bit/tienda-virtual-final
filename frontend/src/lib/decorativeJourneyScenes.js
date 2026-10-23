// Each composition follows the structure of its section. All values are ratios,
// so the same choreography works with another store's artwork and content.
const compositions={
  banner:{points:[[.76,.3],[.94,.3],[.9,.65],[.76,.73]],angle:[20,40],scale:1.12},
  tendencia:{points:[[.14,.66],[.3,.82],[.66,.82],[.84,.66]],mobile:[[.84,.29],[.9,.4],[.91,.55],[.82,.59]],angle:[10,50],scale:.9},
  look:{points:[[.51,.44],[.56,.58],[.49,.75],[.5,.8]],mobile:[[.84,.3],[.89,.42],[.9,.62],[.82,.73]],angle:[-42,-20],scale:1},
  complementos:{points:[[.85,.35],[.94,.54],[.87,.78],[.7,.8]],mobile:[[.14,.24],[.06,.34],[.15,.46],[.27,.42]],angle:[-20,42],scale:1.08},
  categorias:{points:[[.16,.59],[.29,.86],[.7,.88],[.84,.57]],mobile:[[.14,.4],[.3,.53],[.7,.65],[.85,.48]],angle:[5,58],scale:1.02},
  instagram:{points:[[.87,.33],[.97,.43],[.96,.67],[.86,.78]],mobile:[[.87,.27],[.95,.34],[.9,.45],[.85,.58]],angle:[-42,-24],scale:.98},
  tiktok:{points:[[.6,.35],[.63,.5],[.61,.67],[.59,.78]],mobile:[[.14,.55],[.06,.63],[.09,.76],[.2,.8]],angle:[-44,-18],scale:1.06},
  informacion:{points:[[.15,.74],[.34,.63],[.66,.85],[.85,.68]],mobile:[[.86,.44],[.92,.53],[.84,.64],[.85,.7]],angle:[12,48],scale:.92},
  footer:{points:[[.85,.34],[.94,.69],[.7,.83],[.5,.73]],mobile:[[.86,.1],[.92,.15],[.85,.28],[.84,.3]],angle:[-20,45],scale:1.1},
};
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const cubic=(a,b,c,d,t)=>{const s=1-t;return s*s*s*a+3*s*s*t*b+3*s*t*t*c+t*t*t*d;};
const mix=(a,b,t)=>a+(b-a)*t;
function sectionPose(id,t,settings,path,intensity=65,compact=false){
  t=.5+(t-.5)*(.5+Math.max(20,Math.min(100,intensity))/200);
  const c=compositions[id] || compositions.look,p=compact && c.mobile?c.mobile:c.points;
  let x=cubic(...p.map(v=>v[0]),t),y=cubic(...p.map(v=>v[1]),t);
  const placement=settings?.placement || 'auto';
  if(placement==='left')x=.13;
  else if(placement==='right')x=.87;
  else if(path==='edges' && placement==='auto')x=.5+.37*Math.tanh((x-.5)*9);
  if(placement==='bottom')y=.8;
  return {x,y,angle:mix(...c.angle,t),scale:c.scale*(settings?.scale || 100)/100,accent:(settings?.accent ?? 65)/100,opacity:settings?.enabled===false?0:1};
}
export function journeyScene(scroll,chapters,height,width,config,staticPose=false){
  const last=chapters.at(-1),maxScroll=Math.max(0,last?last.top+last.height-height:0);
  const stops=chapters.map(chapter=>clamp(chapter.top-height*.18,0,maxScroll));
  const positionScroll=staticPose?0:clamp(scroll,0,maxScroll);
  let index=0;while(maxScroll>0 && index<chapters.length-1 && positionScroll+.75>=stops[index+1])index++;
  const chapter=chapters[index] || {id:'banner',top:0,height},next=chapters[index+1];
  const duration=Math.max(1,(stops[index+1] ?? maxScroll)-(stops[index] || 0));
  const progress=clamp((positionScroll-(stops[index] || 0))/duration),local=clamp(progress/.76);
  const settings=config.sectionSettings || {},from=sectionPose(chapter.id,local,settings[chapter.id],config.path,config.intensity,config.compact);
  const handoff=next?smooth((progress-.76)/.24):0;
  const to=next?sectionPose(next.id,0,settings[next.id],config.path,config.intensity,config.compact):from;
  // A lifted arc carries the same image to the next composition; there is no
  // random re-seeding or replacement of the lead at section boundaries.
  const region=section=>({top:clamp(section.top-positionScroll-(config.originTop || 0),0,height-Math.max(0,config.originTop || 0)),bottom:clamp(section.top+section.height-positionScroll-(config.originTop || 0),0,height-Math.max(0,config.originTop || 0))});
  const fromRegion=region(chapter),toRegion=next?region(next):fromRegion;
  const fromY=mix(fromRegion.top,fromRegion.bottom,from.y),toY=mix(toRegion.top,toRegion.bottom,to.y);
  const bridgeY=Math.min(height*.92,Math.max(fromY,toY)+height*.1);
  const x=mix(from.x,to.x,handoff),y=handoff?cubic(fromY,bridgeY,bridgeY,toY,handoff):fromY;
  return {minY:mix(fromRegion.top,toRegion.top,handoff),maxY:mix(fromRegion.bottom,toRegion.bottom,handoff),id:chapter.id,nextId:next?.id || '',index,progress,handoff,x:x*width,y,angle:mix(from.angle,to.angle,handoff),scale:mix(from.scale,to.scale,handoff),accent:mix(from.accent,to.accent,handoff),opacity:mix(from.opacity,to.opacity,handoff)};
}
// A local continuous displacement keeps the authored path recognizable. There
// is no search between distant free pockets, which can make the lead jump.
export function placeJourneyLead(pose,width,height,size,obstacles,top=0,bottom=height){
  const half=size/2,pad=8,minY=Math.min(bottom-half-pad,top+half+12);
  const bound=(x,y)=>({x:clamp(x,half+pad,width-half-pad),y:clamp(y,minY,bottom-half-pad)});
  const desired=bound(pose.x,pose.y);let x=0,y=0,total=0;
  for(const box of obstacles){
    const dx=Math.max(box.x-desired.x,0,desired.x-box.x-box.width),dy=Math.max(box.y-desired.y,0,desired.y-box.y-box.height);
    const strength=smooth(1-Math.hypot(dx,dy)/(half+24));if(!strength)continue;
    const vx=desired.x-box.x-box.width/2,vy=desired.y-box.y-box.height/2;
    const length=Math.max(half*.5,Math.hypot(vx,vy));
    x+=vx/length*strength;y+=vy/length*strength;total+=strength;
  }
  const weight=Math.max(1,total),shift=half*.8;
  return bound(desired.x+x/weight*shift,desired.y+y/weight*shift);
}
export function journeyTail(lead,width,height){
  const left=lead.x<width/2;
  const p=[{x:left?width+80:-80,y:height*.93},{x:width*.5,y:height*1.12},{x:lead.x+(left?-width*.12:width*.12),y:Math.min(height*.94,lead.y+height*.3)},{x:lead.x,y:lead.y}];
  const samples=Array.from({length:33},(_,i)=>{const t=i/32;return {x:cubic(...p.map(v=>v.x),t),y:cubic(...p.map(v=>v.y),t)};});
  return {d:`M ${p[0].x} ${p[0].y} C ${p.slice(1).map(v=>`${v.x} ${v.y}`).join(' ')}`,samples};
}
export function pointOnJourneyTail(path,t){
  const value=clamp(t)*32,index=Math.min(31,Math.floor(value)),a=path.samples[index],b=path.samples[index+1],p=value-index;
  return {x:mix(a.x,b.x,p),y:mix(a.y,b.y,p),angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
