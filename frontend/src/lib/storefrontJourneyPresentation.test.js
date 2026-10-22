import {expect,it} from 'vitest';
import {journeyActorPresentation,journeyChapterPresentation} from './storefrontJourneyPresentation';

it('uses the real surface and distinct beats for typography, images and actions',()=>{
 const title=journeyActorPresentation({role:'title',index:0}),hero=journeyActorPresentation({role:'hero',index:0}),action=journeyActorPresentation({role:'action',index:0});
 expect(title.frames[0].clipPath).toBeDefined();expect(title.frames[0].rotate).toBeUndefined();
 expect(hero.frames[0].rotate).toContain('0 1 0');expect(action.frames[0].rotate).toContain('1 0 0');
 expect(title.delay).toBeLessThan(hero.delay);expect(hero.delay).toBeLessThan(action.delay);
 const first=journeyActorPresentation({role:'product',index:0}),next=journeyActorPresentation({role:'product',index:1});
 expect(next.delay).toBeGreaterThan(first.delay);expect(next.frames[0].rotate).not.toBe(first.frames[0].rotate);
 for(const plan of [title,hero,action]){
  expect(plan.frames.every(frame=>frame.opacity===1 && !frame.filter)).toBe(true);
  expect(plan.frames.at(-1).translate).toMatch(/^0 0/);
 }
});

it('softens the travel on adapted mobile without removing the opening',()=>{
 const desktop=journeyChapterPresentation(100),mobile=journeyChapterPresentation(100,true);
 expect(desktop.frames[0].transform).toContain('-210px');expect(mobile.frames[0].transform).toContain('-136.5px');
 expect(mobile.frames.at(-1)).toEqual(desktop.frames.at(-1));
 expect(journeyActorPresentation({role:'hero',index:0},100,true).frames[0].rotate).toContain('19.5deg');
});
