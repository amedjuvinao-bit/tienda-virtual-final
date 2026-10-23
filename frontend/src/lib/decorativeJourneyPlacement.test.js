import { expect, it } from 'vitest';
import { fitJourneyOrnament, ornamentClearance } from './decorativeJourneyPlacement';

it('places the whole ornament outside a photo and all of its story panel',()=>{
  const panels=[{x:20,y:140,width:720,height:660},{x:780,y:140,width:480,height:660}];
  const p=fitJourneyOrnament({x:1100,y:350},1280,190,panels,0,800);
  expect(p.extent).toBeLessThan(140);
  expect(p.y+p.extent/2).toBeLessThan(140);
  expect(ornamentClearance(p,p.extent,0,panels)).toBe(1);
});

it('hides the entire image during a covered passage rather than exposing fragments',()=>{
  const photo={x:200,y:150,width:500,height:500};
  expect(ornamentClearance({x:700,y:300},120,35,[photo])).toBe(0);
  expect(ornamentClearance({x:820,y:300},120,35,[photo])).toBe(1);
});

it('fits the visible section on mobile and does not borrow the following section',()=>{
  const panels=[{x:12,y:160,width:366,height:500}];
  const p=fitJourneyOrnament({x:350,y:270},390,110,panels,0,660);
  expect(p.x-p.extent/2).toBeGreaterThanOrEqual(0);
  expect(p.x+p.extent/2).toBeLessThanOrEqual(390);
  expect(p.y+p.extent/2).toBeLessThan(160);
  expect(ornamentClearance(p,p.extent,0,panels)).toBe(1);
});

it('does not force an ornament over a completely occupied surface',()=>{
  const panels=[{x:0,y:0,width:390,height:844}];
  const p=fitJourneyOrnament({x:200,y:500},390,90,panels,0,844);
  expect(ornamentClearance(p,p.extent,0,panels)).toBe(0);
});
