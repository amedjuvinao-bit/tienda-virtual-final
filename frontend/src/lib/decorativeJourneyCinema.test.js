import {expect,it} from 'vitest';
import {cinematicOrnament} from './decorativeJourneyCinema';
it('keeps rigid scenery at the edges with distinct camera speeds',()=>{
 const base={phase:0,width:1280,height:800,size:230,aspect:3,count:6};
 const displacement=[];
 for(let i=0;i<6;i++){
  const a=cinematicOrnament(i,base),b=cinematicOrnament(i,{...base,phase:.1});
  expect(b.x).toBe(a.x);expect(b.scale).toBe(a.scale);expect(Math.abs(b.angle)).toBeLessThan(7);
  expect(a.x<70||a.x>1210).toBe(true);displacement.push(b.y-a.y);
 }
 expect(new Set(displacement.map(n=>n.toFixed(2))).size).toBeGreaterThan(1);
});
it('wraps only while the ornament is outside the visible scene',()=>{
 const base={width:390,height:844,size:110,aspect:3,compact:true,count:4};let previous;
 for(let phase=0;phase<30;phase+=.01){
  const pose=cinematicOrnament(0,{...base,phase});
  if(previous&&Math.abs(pose.y-previous.y)>844){expect(previous.opacity).toBe(0);expect(pose.opacity).toBe(0);}
  previous=pose;
 }
});
