import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import GeneralPanel from './GeneralPanel';
import { normalizeGlobalConfig } from './generalHelpers';

afterEach(cleanup);
it('sube adornos y conserva el recorrido, el fondo y los ajustes móviles al recargar',async()=>{
  let saved;const upload=vi.fn().mockResolvedValue('https://cdn.example.test/adorno.webp');
  function Editor({initial}){
    const [theme,setTheme]=useState(initial || {global:{whatsapp:{phone:'573001234567'}}});saved=theme;
    return <GeneralPanel theme={theme} uploadToCloudinaryViaBackend={upload} setPath={(path,value)=>setTheme(old=>({...old,global:{...old.global,[path.split('.')[1]]:value}}))}/>;
  }
  const view=render(<Editor/>);fireEvent.click(screen.getByRole('button',{name:/Animación global Transiciones/}));
  expect(screen.getByRole('button',{name:'Camino continuo',exact:true})).toHaveAttribute('aria-pressed','true');
  fireEvent.change(screen.getByLabelText('Seleccionar imagen para Adorno principal'),{target:{files:[new File(['image'],'adorno.png',{type:'image/png'})]}});
  await waitFor(()=>expect(saved.global.sectionMotion.journey.image).toBe('https://cdn.example.test/adorno.webp'));
  expect(upload).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'Recorrido',exact:true}));
  fireEvent.change(screen.getByRole('combobox',{name:'Forma del camino'}),{target:{value:'edges'}});
  fireEvent.change(screen.getByRole('slider',{name:'Tamaño de los adornos'}),{target:{value:'230'}});
  fireEvent.change(screen.getByRole('slider',{name:'Cantidad de adornos'}),{target:{value:'26'}});
  fireEvent.change(screen.getByRole('slider',{name:'Profundidad del camino'}),{target:{value:'90'}});
  fireEvent.change(screen.getByRole('slider',{name:'Opacidad de los adornos'}),{target:{value:'75'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Mostrar hilo que une los adornos'}));
  fireEvent.click(screen.getByRole('button',{name:'Fondo',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Usar solo el color de la tienda'}));
  fireEvent.click(screen.getByRole('button',{name:'Móvil',exact:true}));
  fireEvent.change(screen.getByRole('slider',{name:'Tamaño de adornos en móvil'}),{target:{value:'100'}});
  fireEvent.change(screen.getByRole('slider',{name:'Cantidad de adornos en móvil'}),{target:{value:'8'}});
  expect(saved.global.sectionMotion).toMatchObject({experience:'journey',journey:{image:'https://cdn.example.test/adorno.webp',path:'edges',size:230,density:26,depth:90,opacity:75,stemVisible:false,backgroundImage:'',mobileSize:100,mobileDensity:8}});
  expect(saved.global.whatsapp.phone).toBe('573001234567');
  const persisted=JSON.parse(JSON.stringify(saved));view.unmount();render(<Editor initial={{...persisted,global:normalizeGlobalConfig(persisted.global)}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Animación global Transiciones/}));
  expect(screen.getByAltText('Imagen de Adorno principal')).toHaveAttribute('src','https://cdn.example.test/adorno.webp');
  fireEvent.click(screen.getByRole('button',{name:'Recorrido',exact:true}));expect(screen.getByRole('slider',{name:'Tamaño de los adornos'})).toHaveValue('230');
  fireEvent.click(screen.getByRole('button',{name:'Entradas por sección',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Camino continuo',exact:true}));
  expect(saved.global.sectionMotion.journey.image).toBe('https://cdn.example.test/adorno.webp');
});
