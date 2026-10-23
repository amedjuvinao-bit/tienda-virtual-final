import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ScrollButton from './ScrollButton';

let y,frames;
function setup(config={}){
  y=0;frames=[];
  document.body.innerHTML='<section id="first"></section><section id="middle" style="scroll-margin-top:102px"></section><section id="last"></section>';
  ['first','middle','last'].forEach((id,i)=>Object.defineProperty(document.getElementById(id),'offsetTop',{value:i*1000}));
  vi.stubGlobal('matchMedia',query=>Object.assign(new EventTarget(),{matches:query.includes('767px')}));
  vi.spyOn(window,'scrollY','get').mockImplementation(()=>y);
  vi.spyOn(window,'innerHeight','get').mockReturnValue(800);
  vi.spyOn(document.documentElement,'scrollHeight','get').mockReturnValue(3000);
  vi.spyOn(window,'scrollTo').mockImplementation(({top})=>{y=top;});
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frames.push(callback);return frames.length;});
  vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
  return render(<ScrollButton config={{sectionIds:['first','middle','last'],behavior:'auto',...config}} motionConfig={{pace:'leisurely'}}/>);
}
const flush=()=>act(()=>{const pending=frames;frames=[];pending.forEach(fn=>fn(100));});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.innerHTML='';});
it('avanza una sección por pulsación, conserva el inicio exacto y no vuelve al principio al llegar al final',()=>{
  setup();expect(screen.getByRole('navigation',{name:'Recorrido por las secciones'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Sección anterior'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));flush();expect(y).toBe(1000);
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));flush();expect(y).toBe(2000);
  expect(screen.getByRole('button',{name:'Siguiente sección'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Sección anterior'}));flush();expect(y).toBe(898);
  expect(screen.getByLabelText('Sección 2 de 3')).toBeInTheDocument();
  y=950;fireEvent.scroll(window);flush();
  expect(screen.getByLabelText('Sección 2 de 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));flush();expect(y).toBe(2000);
});
it('permite apagar el control móvil desde la configuración sin mostrar las flechas de escritorio',()=>{
  setup({mobileEnabled:false});expect(screen.queryByRole('button',{name:'Siguiente sección'})).not.toBeInTheDocument();
  expect(document.documentElement).not.toHaveClass('rb-mobile-section-dock-enabled');
});
it('bloquea pulsaciones repetidas mientras recorre una sección y libera el control al tocar la pantalla',()=>{
  setup({behavior:'smooth'});
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));
  expect(screen.getByRole('navigation')).toHaveAttribute('aria-busy','true');
  expect(screen.getByRole('button',{name:'Siguiente sección'})).toBeDisabled();
  fireEvent.touchStart(window);flush();
  expect(screen.getByRole('navigation')).toHaveAttribute('aria-busy','false');
  expect(screen.getByRole('button',{name:'Siguiente sección'})).toBeEnabled();
});

it('coloca la guía en el borde aunque el escritorio conserve controles centrados y permite cambiar de lado',()=>{
  const view=setup({position:'center'});
  expect(screen.getByRole('navigation')).toHaveAttribute('data-align','right');
  view.rerender(<ScrollButton config={{sectionIds:['first','middle','last'],position:'center',mobilePosition:'left',behavior:'auto'}}/>);
  expect(screen.getByRole('navigation')).toHaveAttribute('data-align','left');
});
