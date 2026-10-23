// One continuously deforming vine, sampled without DOM measurements.
// Every ornament keeps its identity and moves along this same curve.
const curve=(a,b,c,d,t)=>{const s=1-t;return s*s*s*a+3*s*s*t*b+3*s*t*t*c+t*t*t*d;};
export function journeyCurve(phase,width,height,route='flowing',intensity=65,composition={}){
  const strength=(.35+intensity/100*.65)*(composition.compact ? .4 : 1), swing=Math.sin(phase*.63)*.14*strength;
  const base=composition.compact
    ? route==='edges'
      ? [[-.05,-.1],[.04,.05],[.12,.25],[.05,.5],[-.06,.85],[.2,1.04],[.52,1.04],[.95,1.04],[1.04,.55],[.95,.33],[.88,.12],[.98,-.06],[1.05,-.1]]
      : [[-.12,.02],[.18,-.06],[.78,-.06],[.92,.055],[1.08,.20],[1.08,.55],[.98,.73],[.84,.98],[.70,1.12],[.42,1.04],[.02,.92],[-.12,.36],[-.12,.02]]
    : route==='edges'
    ? [[-.18,-.35],[.02,-.12],[.18,.03],[.10,.32],[-.12,.65],[.01,.92],[.35,1.12],[.76,1.28],[1.18,.98],[.94,.60],[.80,.19],[1.20,.01],[1.18,-.35]]
    : [[-.18,-.35],[.20,-.34],[.94,-.20],[.69,.14],[.40,.49],[-.22,.20],[.06,.68],[.27,1.10],[1.18,1.08],[.94,.62],[.76,.23],[1.24,.16],[1.18,-.35]];
  // A section's composition frames its own layout. The complete curve morphs
  // into the next composition during handoff; ornaments never get re-seeded.
  const frames={banner:[1,1,-.03],tendencia:[1,.92,.05],look:[1.02,.95,.02],complementos:[.97,1.02,0],categorias:[1.02,.86,.01],instagram:[1.06,.94,-.02],tiktok:[1.04,.96,.02],informacion:[.98,.90,.04],footer:[1,.80,.12]};
  const transform=(x,y,id,placement)=>{
    const [sx,sy,dy]=frames[id] || [1,1,0];x=.5+(x-.5)*sx;y=.5+(y-.5)*sy+dy;
    if(placement==='left')x=-.08+x*.4;
    if(placement==='right')x=.68+x*.4;
    if(placement==='bottom')y=.68+y*.4;
    return {x,y};
  };
  const points=base.map(([x,y],i)=>{
    x+=swing+Math.sin(phase*.76+i*.63)*.075*strength;y+=Math.cos(phase*.53+i*.71)*.085*strength;
    const a=transform(x,y,composition.section,composition.placement),b=transform(x,y,composition.nextSection || composition.section,composition.nextPlacement),t=composition.handoff || 0;
    return {x:(a.x+(b.x-a.x)*t)*width,y:(a.y+(b.y-a.y)*t)*height};
  });
  let d=`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for(let i=1;i<points.length;i+=3)d+=` C ${points.slice(i,i+3).map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')}`;
  const samples=[],segments=(points.length-1)/3;
  let length=0;
  for(let i=0;i<=160;i++){
    const local=i/160*segments,segment=Math.min(segments-1,Math.floor(local)),t=local-segment,p=points.slice(segment*3,segment*3+4);
    const x=curve(p[0].x,p[1].x,p[2].x,p[3].x,t),y=curve(p[0].y,p[1].y,p[2].y,p[3].y,t),previous=samples.at(-1);
    if(previous)length+=Math.hypot(x-previous.x,y-previous.y);
    samples.push({x,y,length});
  }
  return {d,samples,length};
}
export function pointOnJourney(path,fraction){
  const target=Math.max(0,Math.min(1,fraction))*path.length;
  let lo=0,hi=path.samples.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(path.samples[mid].length<target)lo=mid+1;else hi=mid;}
  const index=Math.max(1,lo),b=path.samples[index],a=path.samples[index-1],t=(target-a.length)/Math.max(.001,b.length-a.length);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
export function journeyPhase(scroll,tops,viewport){
  if(!tops.length)return 0;
  const position=scroll+viewport*.18;
  let index=0;while(index<tops.length-1 && position>=tops[index+1])index++;
  const next=tops[index+1]??tops[index]+viewport;
  return Math.max(0,index+(position-tops[index])/Math.max(1,next-tops[index]));
}

// Fade the whole ornament near unboxed text, rather than cutting a rectangular
// hole through the image. Radius includes rotation, so every visible edge clears
// the text; the continuous falloff follows scroll in either direction.
export function journeyTextVisibility(x,y,radius,boxes,clearance=20){
  let visibility=1;
  for(const box of boxes){
    const dx=Math.max(box.x-x,0,x-box.x-box.width),dy=Math.max(box.y-y,0,y-box.y-box.height);
    visibility=Math.min(visibility,Math.max(0,Math.min(1,(Math.hypot(dx,dy)-radius)/clearance)));
  }
  return visibility;
}

// Keep a recognisable piece of the source artwork. Tiny remnants behind a
// photograph fade as a whole; the mask still protects every content pixel.
export function journeyOrnamentVisibility(x,y,size,angle,boxes,width,height,aspect=1){
  const r=angle*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r);let clear=0,onscreen=0;
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){
    const a=(col/4-.5)*size/Math.sqrt(aspect),b=(row/4-.5)*size*Math.sqrt(aspect),px=x+a*cos-b*sin,py=y+a*sin+b*cos;
    if(px<0 || px>width || py<0 || py>height)continue;onscreen++;
    if(!boxes.some(box=>px>=box.x && px<=box.x+box.width && py>=box.y && py<=box.y+box.height))clear++;
  }
  if(!onscreen)return 0;
  const value=Math.max(0,Math.min(1,(clear/onscreen-.28)/.37));
  return value*value*(3-2*value);
}
