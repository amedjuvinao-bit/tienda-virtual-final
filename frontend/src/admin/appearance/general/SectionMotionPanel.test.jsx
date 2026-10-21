import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import GeneralPanel from './GeneralPanel';
import { normalizeGlobalConfig } from './generalHelpers';
afterEach(cleanup);
it('elige los cuatro temas, conserva los ajustes al recargar y mantiene disponibles WhatsApp y carga',()=>{
  let saved;
  function Editor({initial}){const [theme,setTheme]=useState(initial || {global:{whatsapp:{phone:'573001234567'}}});saved=theme;return <GeneralPanel theme={theme} setPath={(path,value)=>setTheme(old=>({...old,global:{...old.global,[path.split('.')[1]]:value}}))}/>;}
  const view=render(<Editor/>);
  fireEvent.click(screen.getByRole('button',{name:/Animación global Transiciones/}));
  expect(screen.getAllByRole('radio')).toHaveLength(4);
  for(const name of ['Escaparate en capas','Álbum editorial','Composición en abanico','Tarjeta desplegable']) {
    fireEvent.click(screen.getByRole('radio',{name:new RegExp(name)}));
    expect(screen.getByRole('radio',{name:new RegExp(name)})).toBeChecked();
  }
  fireEvent.click(screen.getByRole('radio',{name:/Álbum editorial/}));
  fireEvent.change(screen.getByRole('slider',{name:'Intensidad de la animación global'}),{target:{value:'85'}});
  fireEvent.change(screen.getByRole('combobox',{name:'Ritmo del recorrido'}),{target:{value:'leisurely'}});
  fireEvent.change(screen.getByRole('combobox',{name:'Comportamiento en móvil'}),{target:{value:'off'}});
  expect(saved.global.sectionMotion).toEqual({enabled:true,preset:'depth',intensity:85,pace:'leisurely',mobileMode:'off'});
  expect(saved.global.whatsapp.phone).toBe('573001234567');
  const persisted=JSON.parse(JSON.stringify(saved));view.unmount();render(<Editor initial={{...persisted,global:normalizeGlobalConfig(persisted.global)}}/>);
  fireEvent.click(screen.getByRole('button',{name:/Animación global Transiciones/}));
  expect(screen.getByRole('radio',{name:/Álbum editorial/})).toBeChecked();
  expect(screen.getByRole('slider',{name:'Intensidad de la animación global'})).toHaveValue('85');
  fireEvent.click(screen.getByRole('checkbox',{name:'Activar animación global'}));
  expect(saved.global.sectionMotion.enabled).toBe(false);
  expect(saved.global.sectionMotion.preset).toBe('depth');
});
