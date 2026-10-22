import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import FooterSection from '../FooterSection';
const original=Object.getOwnPropertyDescriptor(Element.prototype,'animate');
afterEach(()=>{cleanup();vi.restoreAllMocks();if(original)Object.defineProperty(Element.prototype,'animate',original);else delete Element.prototype.animate;});
function setup(reduced=false){
 const animations=[];
 Object.defineProperty(Element.prototype,'animate',{configurable:true,value:vi.fn(function(frames,options){const animation={cancel:vi.fn(),onfinish:null};animations.push({node:this,frames,options,animation});return animation;})});
 vi.spyOn(window,'matchMedia').mockReturnValue({matches:reduced,addEventListener(){},removeEventListener(){}});
 render(<FooterSection theme={{sections:[],footer:{tiktok:'https://www.tiktok.com/@negocio',instagram:'https://instagram.com/negocio'}}}/>);
 return animations;
}
it('animates a social click and keeps native navigation immediate',()=>{
 const animations=setup(),link=screen.getByRole('link',{name:'TikTok'});let prevented;
 link.addEventListener('click',event=>{prevented=event.defaultPrevented;event.preventDefault();});
 fireEvent.click(link.querySelector('path'));
 expect(prevented).toBe(false);expect(link).toHaveAttribute('href','https://www.tiktok.com/@negocio');expect(link).toHaveAttribute('target','_blank');
 expect(animations.some(a=>a.node===link)).toBe(true);expect(animations.some(a=>a.node.classList.contains('footer-ed__social-emblem'))).toBe(true);
});
it('restarts repeated presses and supports keyboard-generated clicks',()=>{
 const animations=setup(),link=screen.getByRole('link',{name:'Instagram'});
 link.addEventListener('click',event=>event.preventDefault());fireEvent.click(link,{detail:0});
 const first=animations.slice();fireEvent.click(link);
 expect(first.every(a=>a.animation.cancel.mock.calls.length===1)).toBe(true);
 expect(animations.filter(a=>a.node===link)).toHaveLength(2);
 const toggle=screen.getByRole('button',{name:'Nuestra tienda'});fireEvent.click(toggle,{detail:0});expect(toggle).toHaveAttribute('aria-expanded','true');
 expect(animations.some(a=>a.node===toggle)).toBe(true);
});
it('respects reduced motion while preserving the action',()=>{
 const animations=setup(true),toggle=screen.getByRole('button',{name:'Nuestra tienda'});
 fireEvent.click(toggle);expect(toggle).toHaveAttribute('aria-expanded','true');expect(animations).toHaveLength(0);
});
