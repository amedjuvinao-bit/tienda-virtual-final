import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render} from '@testing-library/react';
import LookGlassRim from './LookGlassRim';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('measures the local frame rather than its transformed screen rectangle',()=>{
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(550);
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(690);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:550,height:138});
 const {container}=render(<LookGlassRim radius={26}/>);
 expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 550 690');
});
it('updates the local dimensions when the layout actually resizes',()=>{
 let width=550,height=690,resize;
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockImplementation(()=>width);
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockImplementation(()=>height);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({width:100,height:100});
 vi.stubGlobal('ResizeObserver',class{constructor(callback){resize=callback;}observe(){}disconnect(){}});
 const {container}=render(<LookGlassRim radius={26}/>);
 expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 550 690');
 width=280;height=400;act(()=>resize());
 expect(container.querySelector('svg').getAttribute('viewBox')).toBe('0 0 280 400');
});
