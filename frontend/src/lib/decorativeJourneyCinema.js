export const CINEMATIC_CYCLE=3;
const mod=(n,d)=>(n%d+d)%d;
const smoother=n=>{const t=Math.max(0,Math.min(1,n));return t*t*t*(t*(t*6-15)+10);};
// Move during the handover, then lock the camera for the reading portion.
// The window spans section boundaries, without a pose reset at the boundary.
export function cinematicBeat(phase){
  const shifted=Math.max(0,phase)+.25,chapter=Math.floor(shifted),t=Math.min(1,(shifted-chapter)/.5);
  const eased=smoother(t),position=Math.max(0,chapter-1+eased);
  return {position,arrival:position===0?0:Math.sin(Math.PI*eased),settled:t===1 || position===0};
}
// Rigid scenery travels on parallel camera planes, never along a deforming curve.
// Wraps happen outside the viewport, making the same choreography reversible.
export function cinematicOrnament(index,{phase,width,height,size,aspect=1,depth=.65,compact=false,intensity=65,count=6,cameraPhase,length=100}){
  // Alternate left/right arrivals, then continue to the next depth plane.
  // Delay is driven by scroll phase, so reversing scroll reverses the sequence.
  const delay=index*.06;
  // The runtime eases this target once. Applying the beat after the spring
  // would make a frame pause first and start a second movement later.
  phase=Number.isFinite(cameraPhase)?cameraPhase:cinematicBeat(Math.max(0,phase-delay)).position;
  const right=index%2===1,plane=Math.floor(index/2),planes=Math.ceil(count/2);
  const rate=(right?.34:.29)*(.65+intensity/200);
  const camera=phase*1.2+plane*1.7+(right?.65:0),relief=depth*(compact?.68:1),approach=(Math.sin(camera)+1)/2;
  const requestedScale=size/100*(compact?1.3:1.55)*[1,.78,1.12][plane%3]*(1+depth*(plane===2?.12:0))*(1+approach*relief*.24);
  // Pieces share a camera speed but arrive at staggered times.
  // Reserve enough room for the whole tilted/projected silhouette and a gap.
  // During staggered arrivals a neighbour can be one destination ahead.
  // Reserve that full travel distance to prevent the pieces bunching up.
  const slotHeight=height*(CINEMATIC_CYCLE/planes-rate)-Math.max(32,height*.12);
  const projectedHeight=100*(Math.sqrt(aspect)+.14/Math.sqrt(aspect))*1.16;
  const scale=Math.min(requestedScale,Math.max(.1,slotHeight/projectedHeight));
  const lengthScale=Math.max(.5,Math.min(2.5,length/100));
  // Reserve the extra vertical silhouette without shrinking the ornament's
  // width. Recycling still happens beyond the enlarged silhouette's edges.
  const extraHeight=Math.max(0,slotHeight)*(Math.max(1,lengthScale)-1);
  const cycle=CINEMATIC_CYCLE+planes*extraHeight/height;
  const margin=lengthScale>1?Math.max(.4+extraHeight/(2*height),slotHeight*lengthScale/(2*height)+.12):.4;
  const position=mod(.3+margin-.4+plane*cycle/planes+(right?.24:0)-phase*rate,cycle)-margin;
  const halfWidth=50/Math.sqrt(aspect)*scale;
  const inset=Math.min(width*(compact?.045:.035),halfWidth*.28);
  return {x:right?width-inset:inset,y:position*height,scale,lengthScale,cycle,
    tiltY:(right?-1:1)*(10+Math.sin(camera)*18)*relief,tiltX:Math.cos(camera*.8)*12*relief,
    lift:approach*relief*42,shadowX:(right?-1:1)*(3+approach*13)*relief,
    shadowY:5+approach*relief*16,shadowBlur:5+approach*relief*12,light:1+Math.cos(camera-.6)*relief*.07,
    angle:(right?-1:1)*([5,-4,2][plane%3]+Math.sin(phase*.18+plane)*1.5),
    opacity:[1,.88,.94][plane%3]};
}

// Analytic critically damped camera: continuous velocity, a soft follow-through,
// and gradual braking at the destination. It stops scheduling after settling.
export function advanceCinematicCamera(position,velocity,target,deltaMs){
 const dt=Math.max(0,Math.min(50,deltaMs))/1000,omega=6.4,offset=position-target;
 const impulse=velocity+omega*offset,decay=Math.exp(-omega*dt);
 return {position:target+(offset+impulse*dt)*decay,velocity:(velocity-omega*impulse*dt)*decay};
}
