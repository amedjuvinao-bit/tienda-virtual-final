import {expect,it} from 'vitest';
import {cinematicOrnament,cinematicBeat,CINEMATIC_CYCLE} from './decorativeJourneyCinema';
it('keeps rigid scenery at the edges with distinct camera speeds',()=>{
 const base={phase:.95,width:1280,height:800,size:230,aspect:3,count:6};
 const displacement=[];
 for(let i=0;i<6;i++){
  const a=cinematicOrnament(i,base),b=cinematicOrnament(i,{...base,phase:1.05});
  expect(Math.abs(b.x-a.x)).toBeLessThan(2);expect(b.scale/a.scale).toBeGreaterThan(.85);expect(b.scale/a.scale).toBeLessThan(1.15);expect(Math.abs(b.angle)).toBeLessThan(7);
  expect(a.x<70||a.x>1210).toBe(true);displacement.push(b.y-a.y);
 }
 expect(new Set(displacement.map(n=>n.toFixed(2))).size).toBeGreaterThan(1);
});
it('never flashes or fades pieces during movement or recycling',()=>{
 for(let phase=0;phase<30;phase+=.01){
  const pose=cinematicOrnament(0,{phase,width:390,height:844,size:110,aspect:3,compact:true,count:4});
  expect(pose.opacity).toBe(1);
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
   const distance=Math.abs(poses[i].y-poses[j].y),gap=Math.min(distance,height*CINEMATIC_CYCLE-distance);
   const extent=100*(Math.sqrt(aspect)+.14/Math.sqrt(aspect))*1.16*(poses[i].scale+poses[j].scale)/2;
   expect(gap-extent).toBeGreaterThanOrEqual(Math.max(32,height*.12)-.001);
  }
 }
});

it('locks the frame at its destination and carries the arrival continuously across sections',()=>{
 const base={width:1280,height:800,size:230,aspect:3,depth:1};
 expect(cinematicOrnament(0,{...base,phase:2.35})).toEqual(cinematicOrnament(0,{...base,phase:2.6}));
 const a=cinematicOrnament(0,{...base,phase:2.99999}),b=cinematicOrnament(0,{...base,phase:3.00001});
 expect(Math.abs(a.y-b.y)).toBeLessThan(.1);expect(Math.abs(a.tiltY-b.tiltY)).toBeLessThan(.1);
 expect(cinematicBeat(2.4).settled).toBe(true);expect(cinematicBeat(3).arrival).toBeGreaterThan(.5);
});

it('starts left and right frames in sequence instead of moving every frame together',()=>{
 const base={width:1280,height:800,size:230,aspect:3,depth:1,count:6};
 const moved=[];
 for(let i=0;i<6;i++){
  const before=cinematicOrnament(i,{...base,phase:2.85}),after=cinematicOrnament(i,{...base,phase:2.98});
  moved.push(Math.abs(after.y-before.y)>.01);
 }
 expect(moved).toEqual([true,false,false,false,false,false]);
 const next=cinematicOrnament(1,{...base,phase:3.09}),start=cinematicOrnament(1,{...base,phase:2.85});
 expect(Math.abs(next.y-start.y)).toBeGreaterThan(1);
 for(let i=0;i<6;i++)expect(cinematicOrnament(i,{...base,phase:3.7})).toEqual(cinematicOrnament(i,{...base,phase:3.8}));
});
