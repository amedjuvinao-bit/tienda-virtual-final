import {expect,it} from 'vitest';
import {cinematicOrnament} from './decorativeJourneyCinema';
it('keeps rigid scenery at the edges with distinct camera speeds',()=>{
 const base={phase:0,width:1280,height:800,size:230,aspect:3,count:6};
 const displacement=[];
 for(let i=0;i<6;i++){
  const a=cinematicOrnament(i,base),b=cinematicOrnament(i,{...base,phase:.1});
  expect(Math.abs(b.x-a.x)).toBeLessThan(2);expect(b.scale/a.scale).toBeGreaterThan(.98);expect(b.scale/a.scale).toBeLessThan(1.02);expect(Math.abs(b.angle)).toBeLessThan(7);
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

it('adds reversible perspective and light controlled by depth',()=>{
 const base={phase:1,width:1280,height:800,size:230,aspect:3,depth:1};
 const a=cinematicOrnament(0,base),b=cinematicOrnament(0,{...base,phase:2});
 expect(a.tiltY).not.toBe(b.tiltY);expect(a.lift).not.toBe(b.lift);expect(a.shadowX).not.toBe(b.shadowX);
 expect(cinematicOrnament(0,base)).toEqual(a);
 const flat=cinematicOrnament(0,{...base,depth:0});expect(flat.tiltY).toBe(0);expect(flat.tiltX).toBe(0);expect(flat.lift).toBe(0);
});

it('keeps tall ornaments separated on each edge throughout the scroll',()=>{
 for(const compact of [false,true])for(const aspect of [1,3,5])for(let phase=0;phase<20;phase+=.1){
  const height=compact?844:800,count=compact?4:6;
  const poses=Array.from({length:count},(_,i)=>cinematicOrnament(i,{phase,width:compact?390:1280,height,size:320,aspect,depth:1,compact,count}));
  for(let i=0;i<count;i++)for(let j=i+2;j<count;j+=2){
   const distance=Math.abs(poses[i].y-poses[j].y),gap=Math.min(distance,height*1.8-distance);
   const extent=100*(Math.sqrt(aspect)+.14/Math.sqrt(aspect))*1.16*(poses[i].scale+poses[j].scale)/2;
   expect(gap-extent).toBeGreaterThanOrEqual(Math.max(32,height*.12)-.001);
  }
 }
});
