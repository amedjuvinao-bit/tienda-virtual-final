import {expect,it} from 'vitest';
import {journeyCurtainFrame} from './storefrontJourneyPresentation';

it('sweeps the full viewport with a continuous curved leading and trailing edge',()=>{
 const initial=journeyCurtainFrame(0,1200,800),covered=journeyCurtainFrame(.5,1200,800),cleared=journeyCurtainFrame(1,1200,800);
 expect(initial.path).toContain('M 0 880.00');expect(covered.path).toContain('M 0 -80.00');
 expect(cleared.path).toContain('1200.00 -80.00');expect(cleared.phase).toBe('reveal');
 for(const width of[320,390,1440])for(let p=0;p<=1;p+=.01){
  const frame=journeyCurtainFrame(p,width,844);
  expect(frame.path).toContain(' C ');expect(frame.path).not.toMatch(/NaN|Infinity/);expect(frame.path).toContain(width.toFixed(2));
 }
});
it('mirrors the sweep when returning and scales curvature with intensity and mobile adaptation',()=>{
 const down=journeyCurtainFrame(.25,390,844),up=journeyCurtainFrame(.25,390,844,{direction:'up'});
 expect(down.path).toContain('M 0 422.00');expect(up.path).toContain('M 0 422.00');expect(up.path).not.toBe(down.path);
 expect(journeyCurtainFrame(.25,390,844,{intensity:20}).path).not.toBe(journeyCurtainFrame(.25,390,844,{intensity:100}).path);
 expect(journeyCurtainFrame(.25,390,844,{compact:true}).path).not.toBe(down.path);
});
