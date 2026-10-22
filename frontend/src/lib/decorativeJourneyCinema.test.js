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
