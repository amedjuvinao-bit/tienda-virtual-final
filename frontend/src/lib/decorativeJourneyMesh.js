import { pointOnJourney } from './decorativeJourneyGeometry';

export const JOURNEY_ARTWORK_BANDS=20;
export function journeyArtworkTriangles(index,vertical=true){
  const a=index/JOURNEY_ARTWORK_BANDS,b=(index+1)/JOURNEY_ARTWORK_BANDS;
  const p=vertical?[[0,a],[1,a],[0,b],[1,b]]:[[a,0],[a,1],[b,0],[b,1]];
  return [[p[0],p[1],p[2]],[p[1],p[3],p[2]]];
}
function affine(source,target){
  const [[x0,y0],[x1,y1],[x2,y2]]=source,[[u0,v0],[u1,v1],[u2,v2]]=target;
  const det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
  const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/det,c=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/det;
  const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/det,d=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/det;
  return [a,b,c,d,u0-a*x0-c*y0,v0-b*x0-d*y0];
}
// Map the source texture onto a ribbon sampled from the actual curve. Shared
// row vertices make the whole garland bend, instead of rotating a rigid image
// around one crossing point. The original raster and proportions are retained.
export function journeyArtworkMesh(path,fraction,layout,scale,center,angle){
  const vertical=layout.axis===90,across=(vertical?layout.width:layout.height)*scale;
  const length=(vertical?layout.height:layout.width)*scale,r=angle*Math.PI/180,cos=Math.cos(r),sin=Math.sin(r);
  const local=p=>{const x=p.x-center.x,y=p.y-center.y;return [(x*cos+y*sin)/scale,(-x*sin+y*cos)/scale];};
  const rows=Array.from({length:JOURNEY_ARTWORK_BANDS+1},(_,i)=>{
    const p=pointOnJourney(path,fraction+(i/JOURNEY_ARTWORK_BANDS-.5)*length/path.length),a=p.angle*Math.PI/180;
    const nx=(vertical?1:-1)*Math.sin(a),ny=(vertical?-1:1)*Math.cos(a);
    return [local({x:p.x-nx*across/2,y:p.y-ny*across/2}),local({x:p.x+nx*across/2,y:p.y+ny*across/2})];
  });
  return Array.from({length:JOURNEY_ARTWORK_BANDS},(_,i)=>{
    const source=journeyArtworkTriangles(i,vertical),[a,b]=rows[i],[c,d]=rows[i+1];
    return [affine(source[0],[a,b,c]),affine(source[1],[b,d,c])];
  }).flat();
}

export function journeyArtworkClipPoints(triangle){
  const cx=triangle.reduce((n,p)=>n+p[0],0)/3,cy=triangle.reduce((n,p)=>n+p[1],0)/3;
  // A subpixel overlap covers raster anti-alias seams between adjacent faces.
  return triangle.map(([x,y])=>{const length=Math.hypot(x-cx,y-cy)||1;return `${x+(x-cx)/length*.0006},${y+(y-cy)/length*.0006}`;}).join(' ');
}
