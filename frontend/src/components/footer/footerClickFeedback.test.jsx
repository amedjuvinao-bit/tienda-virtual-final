import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import FooterSection from '../FooterSection';
const original=Object.getOwnPropertyDescriptor(Element.prototype,'animate');
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();if(original)Object.defineProperty(Element.prototype,'animate',original);else delete Element.prototype.animate;});
function setup(reduced=false){
 const animations=[];
 Object.defineProperty(Element.prototype,'animate',{configurable:true,value:vi.fn(function(frames,options){const animation={cancel:vi.fn(),finish:vi.fn(),onfinish:null};animations.push({node:this,frames,options,animation});return animation;})});
 vi.spyOn(window,'matchMedia').mockReturnValue({matches:reduced,addEventListener(){},removeEventListener(){}});
 render(<FooterSection theme={{sections:[],footer:{tiktok:'https://www.tiktok.com/@negocio',instagram:'https://instagram.com/negocio'}}}/>);
 return animations;
}
it('shows the light press first and completes every animation before opening the destination',()=>{
 vi.useFakeTimers();
 const animations=setup(),link=screen.getByRole('link',{name:'TikTok'});const prevented=[];
 link.addEventListener('click',event=>{prevented.push(event.defaultPrevented);event.preventDefault();});
 fireEvent.click(link.querySelector('path'));
 expect(prevented).toEqual([true]);
 vi.advanceTimersByTime(619);expect(prevented).toEqual([true]);
 vi.advanceTimersByTime(1);expect(prevented).toEqual([true,false]);
 expect(animations.every(a=>a.animation.finish.mock.calls.length===1)).toBe(true);expect(link).toHaveAttribute('href','https://www.tiktok.com/@negocio');expect(link).toHaveAttribute('target','_blank');
 expect(animations.some(a=>a.node===link)).toBe(true);expect(animations.some(a=>a.node.classList.contains('footer-ed__social-emblem'))).toBe(true);
 expect(animations.some(a=>a.node.tagName==='B')).toBe(true);
 expect(animations.flatMap(a=>a.frames).every(frame=>!('boxShadow' in frame)&&!('filter' in frame))).toBe(true);
});
it('restarts repeated presses and supports keyboard-generated clicks',()=>{
 vi.useFakeTimers();
 const animations=setup(),link=screen.getByRole('link',{name:'Instagram'});
 link.addEventListener('click',event=>event.preventDefault());fireEvent.click(link,{detail:0});
 const first=animations.slice();fireEvent.click(link);
 expect(first.every(a=>a.animation.cancel.mock.calls.length===1)).toBe(true);
 expect(animations.filter(a=>a.node===link && a.frames[0].scale)).toHaveLength(2);
 const toggle=screen.getByRole('button',{name:'Nuestra tienda'});fireEvent.click(toggle,{detail:0});expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(animations.some(a=>a.node===toggle)).toBe(true);
});
it('respects reduced motion while preserving the action',()=>{
 const animations=setup(true),toggle=screen.getByRole('button',{name:'Nuestra tienda'});
 fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','true');expect(animations).toHaveLength(0);
});

it('preserves modified-click navigation without delaying or animating it',()=>{
 const animations=setup(),link=screen.getByRole('link',{name:'TikTok'});let prevented;
 link.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault();});
 fireEvent.click(link,{ctrlKey:true});expect(prevented).toBe(false);expect(animations).toHaveLength(0);
});
