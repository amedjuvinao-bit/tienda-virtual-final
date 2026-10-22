import { expect,it } from 'vitest';
import { journeyArtworkLayout } from './decorativeJourneyArtwork';

it('keeps a portrait garland long and narrow without stretching its source',()=>{
  const layout=journeyArtworkLayout(600,1800);
  expect(layout.height/layout.width).toBeCloseTo(3);
  expect(layout.width*layout.height).toBeCloseTo(10000);
  expect(layout.height).toBeGreaterThan(170);expect(layout.axis).toBe(90);
});
it('uses a horizontal long axis for a landscape asset from another store',()=>{
  const layout=journeyArtworkLayout(1800,600);
  expect(layout.width/layout.height).toBeCloseTo(3);
  expect(layout.width*layout.height).toBeCloseTo(10000);expect(layout.axis).toBe(0);
});
it('handles missing dimensions and bounds extreme aspect ratios',()=>{
  expect(journeyArtworkLayout(0,NaN)).toEqual({ratio:1,width:100,height:100,axis:90});
  expect(journeyArtworkLayout(1,999999).ratio).toBe(5);
  expect(journeyArtworkLayout(999999,1).ratio).toBe(.2);
});
