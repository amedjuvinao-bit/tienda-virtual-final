import React, {useState} from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {normalizeEditorial} from './instagramEditorialHelpers';
import {instagramDepthStyle,moveInstagramDepth,resetInstagramDepth} from '../../../../components/instagramDepth';
import InstagramSectionUI from './InstagramSectionUI';
import InstagramSection from '../../../../components/InstagramSection';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const config=()=>normalizeEditorial({});
function media(reduced=false){vi.stubGlobal('matchMedia',vi.fn(query=>({matches:query.includes('prefers-reduced')?reduced:true})));}
function card(){const el=document.createElement('a');el.getBoundingClientRect=vi.fn(()=>({left:0,top:0,width:200,height:300}));return el;}
const theme={sections:[{id:'instagram',enabled:true,config:{posts:[{id:'one',image:'/one.jpg',link:'https://instagram.com/p/one/'}]}}]};
describe('profundidad de Instagram',()=>{
 it('crea planos distintos con perspectiva incluso sin interacción y conserva el tamaño nominal',()=>{
  const back=instagramDepthStyle({layer:1},0,config());const front=instagramDepthStyle({layer:4},3,config());
  expect(parseFloat(front['--photo-depth'])).toBeGreaterThan(parseFloat(back['--photo-depth']));
  expect(front['--photo-tilt-x']).not.toBe('0deg');expect(back['--photo-tilt-y']).not.toBe('0deg');
  expect(back['--photo-rest-scale']).toBeGreaterThan(0);expect(back['--photo-rest-scale']).toBeLessThan(1);
 });
 it('el cursor mueve luz y perspectiva sin realimentarse de los límites transformados',()=>{
  media();const el=card();const event={currentTarget:el,clientX:190,clientY:20,pointerType:'mouse'};
  moveInstagramDepth(event,config());const tilt=el.style.getPropertyValue('--photo-pointer-x');expect(parseFloat(tilt)).toBeGreaterThan(0);
  moveInstagramDepth({...event,clientX:10},config());expect(parseFloat(el.style.getPropertyValue('--photo-pointer-y'))).toBeLessThan(0);
  expect(el.getBoundingClientRect).toHaveBeenCalledTimes(1);
  resetInstagramDepth(event);expect(el.style.getPropertyValue('--photo-pointer-x')).toBe('');expect(el.style.getPropertyValue('--photo-light-x')).toBe('');
 });
 it('respeta reducción de movimiento, pantalla táctil y efectos desactivados',()=>{
  const el=card();const event={currentTarget:el,clientX:190,clientY:20,pointerType:'mouse'};
  media(true);moveInstagramDepth(event,config());expect(el.style.length).toBe(0);
  media(false);moveInstagramDepth({...event,pointerType:'touch'},config());expect(el.style.length).toBe(0);
  moveInstagramDepth(event,{...config(),editorialMotion:'none'});expect(el.style.length).toBe(0);
  moveInstagramDepth(event,{...config(),editorialPointer3D:false});expect(el.style.length).toBe(0);
 });
 it('permite volver al diseño plano desde el mismo panel',()=>{
  const {container,rerender}=render(<InstagramSection theme={theme}/>);expect(container.querySelector('.ig-editorial')).toHaveAttribute('data-depth3d','true');
  rerender(<InstagramSection theme={{sections:[{...theme.sections[0],config:{...theme.sections[0].config,editorialDepthEnabled:false}}]}}/>);
  expect(container.querySelector('.ig-editorial')).toHaveAttribute('data-depth3d','false');
 });
 it('guarda la profundidad desde un grupo corto del editor sin alterar publicaciones',()=>{
  const save=vi.fn();function Harness(){const[t,setT]=useState(theme);return <><InstagramSectionUI theme={t} setPath={(k,v)=>setT({...t,[k]:v})}/><button onClick={()=>save(t)}>Guardar prueba</button></>;}
  render(<Harness/>);
  fireEvent.click(within(screen.getByRole('navigation',{name:'Pasos de edición'})).getByRole('button',{name:/Diseño/}));
  fireEvent.click(within(screen.getByRole('navigation',{name:'Diseño de Instagram'})).getByRole('button',{name:'Fotos y efectos'}));
  fireEvent.change(screen.getByLabelText('Editar fotos y efectos'),{target:{value:'2'}});
  fireEvent.change(screen.getByLabelText('Separación entre capas (px)'),{target:{value:'130'}});
  fireEvent.change(screen.getByLabelText('Perspectiva de la cámara (px)'),{target:{value:'1000'}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar prueba'}));
  expect(save.mock.calls[0][0].sections[0].config).toMatchObject({editorialDepthEnabled:true,editorialDepth:130,editorialPerspective:1000,posts:theme.sections[0].config.posts});
 });
});
