const mod=(n,d)=>(n%d+d)%d;
const smooth=n=>{const t=Math.max(0,Math.min(1,n));return t*t*(3-2*t);};
// Rigid scenery travels on parallel camera planes, never along a deforming curve.
// Wraps happen outside the viewport, making the same choreography reversible.
export function cinematicOrnament(index,{phase,width,height,size,aspect=1,depth=.65,compact=false,intensity=65,count=6}){
  const right=index%2===1,plane=Math.floor(index/2),planes=Math.ceil(count/2);
  const rate=[.22,.15,.1][plane%3]*(.65+intensity/200);
  const cycle=1.8,position=mod(.3+plane*cycle/planes+(right?.24:0)-phase*rate,cycle)-.4;
  const camera=phase*.9+plane*1.7+(right?.65:0),relief=depth*(compact?.68:1),approach=(Math.sin(camera)+1)/2;
  const scale=size/100*(compact?1.3:1.55)*[1,.78,1.12][plane%3]*(1+depth*(plane===2?.12:0))*(1+approach*relief*.24);
  const halfWidth=50/Math.sqrt(aspect)*scale;
  const inset=Math.min(width*(compact?.045:.035),halfWidth*.28);
  return {x:right?width-inset:inset,y:position*height,scale,
    tiltY:(right?-1:1)*(10+Math.sin(camera)*18)*relief,tiltX:Math.cos(camera*.8)*12*relief,
    lift:approach*relief*42,shadowX:(right?-1:1)*(3+approach*13)*relief,
    shadowY:5+approach*relief*16,shadowBlur:5+approach*relief*12,light:1+Math.cos(camera-.6)*relief*.07,
    angle:(right?-1:1)*([5,-4,2][plane%3]+Math.sin(phase*.18+plane)*1.5),
    opacity:smooth((position+.3)/.2)*smooth((1.3-position)/.2)*[1,.72,.9][plane%3]};
}
