import { expect,it } from 'vitest';
import { journeyCurve,pointOnJourney } from './decorativeJourneyGeometry';
import { journeyArtworkLayout } from './decorativeJourneyArtwork';
import { JOURNEY_ARTWORK_BANDS,journeyArtworkMesh } from './decorativeJourneyMesh';

const apply=(matrix,[x,y])=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
for(const [width,height] of [[600,1800],[1800,600]])it(`bends the full ${width}×${height} artwork along the curve, including both ends`,()=>{
  const path=journeyCurve(2.3,1280,800),fraction=.58,layout=journeyArtworkLayout(width,height),scale=1.8;
  const center=pointOnJourney(path,fraction),angle=center.angle-layout.axis,r=angle*Math.PI/180;
  const global=p=>({x:center.x+(p.x*Math.cos(r)-p.y*Math.sin(r))*scale,y:center.y+(p.x*Math.sin(r)+p.y*Math.cos(r))*scale});
  const matrices=journeyArtworkMesh(path,fraction,layout,scale,center,angle),vertical=layout.axis===90;
  const length=(vertical?layout.height:layout.width)*scale,across=(vertical?layout.width:layout.height)*scale;
  expect(matrices).toHaveLength(JOURNEY_ARTWORK_BANDS*2);
  for(let i=0;i<JOURNEY_ARTWORK_BANDS;i++){
    const a=i/JOURNEY_ARTWORK_BANDS,b=(i+1)/JOURNEY_ARTWORK_BANDS;
    for(const [matrix,t] of [[matrices[i*2],a],[matrices[i*2+1],b]]){
      const uv=vertical?[.5,t]:[t,.5],point=global(apply(matrix,uv));
      const expected=pointOnJourney(path,fraction+(t-.5)*length/path.length);
      expect(point.x).toBeCloseTo(expected.x,5);expect(point.y).toBeCloseTo(expected.y,5);
    }
    const left=global(apply(matrices[i*2],vertical?[0,a]:[a,0])),right=global(apply(matrices[i*2],vertical?[1,a]:[a,1]));
    expect(Math.hypot(right.x-left.x,right.y-left.y)).toBeCloseTo(across,5);
  }
});
it('keeps finite geometry when a long garland reaches either end of the path',()=>{
  const path=journeyCurve(0,390,844),layout=journeyArtworkLayout(600,1800);
  for(const fraction of [0,.001,.999,1]){
    const center=pointOnJourney(path,fraction);
    expect(journeyArtworkMesh(path,fraction,layout,3,center,center.angle-90).flat().every(Number.isFinite)).toBe(true);
  }
});
