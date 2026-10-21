// One continuously deforming vine, sampled without DOM measurements.
// Every ornament keeps its identity and moves along this same curve.
const curve=(a,b,c,d,t)=>{const s=1-t;return s*s*s*a+3*s*s*t*b+3*s*t*t*c+t*t*t*d;};
export function journeyCurve(phase,width,height,route='flowing',intensity=65){
  const strength=.35+intensity/100*.65, swing=Math.sin(phase*.63)*.14*strength;
  const base=route==='edges'
    ? [[-.18,-.35],[.02,-.12],[.18,.03],[.10,.32],[-.12,.65],[.01,.92],[.35,1.12],[.76,1.28],[1.18,.98],[.94,.60],[.80,.19],[1.20,.01],[1.18,-.35]]
    : [[-.18,-.35],[.20,-.34],[.94,-.20],[.69,.14],[.40,.49],[-.22,.20],[.06,.68],[.27,1.10],[1.18,1.08],[.94,.62],[.76,.23],[1.24,.16],[1.18,-.35]];
  const points=base.map(([x,y],i)=>({
    x:(x+swing+Math.sin(phase*.76+i*.63)*.075*strength)*width,
    y:(y+Math.cos(phase*.53+i*.71)*.085*strength)*height,
  }));
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
  const b=path.samples[lo],a=path.samples[Math.max(0,lo-1)],t=(target-a.length)/Math.max(.001,b.length-a.length);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}
export function journeyPhase(scroll,tops,viewport){
  if(!tops.length)return 0;
  const position=scroll+viewport*.18;
  let index=0;while(index<tops.length-1 && position>=tops[index+1])index++;
  const next=tops[index+1]??tops[index]+viewport;
  return Math.max(0,index+(position-tops[index])/Math.max(1,next-tops[index]));
}
