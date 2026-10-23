import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import InformacionSection from '../InformacionSection';
import InfoSectionUI from '../../admin/appearance/sections/info/infoSectionUI';
import { normalizeInfoSection } from '../../admin/appearance/sections/info/infoSectionHelpers';
import { normalizeInfoGlass, safeInfoHref } from '../../admin/appearance/sections/info/infoGlassHelpers';

afterEach(cleanup);
const theme = config => ({ global: { whatsapp: { phone: '573001234567', message: 'Mensaje global' } }, sections: [{ id:'informacion',enabled:true,config }] });

describe('Información · modelo de cristal', () => {
  it('conserva el contenido guardado y abre el detalle con cierre por teclado y retorno de foco', () => {
    render(<InformacionSection theme={theme({titleText:'Atención a empresas',cards:[{id:'servicio',heading:'Entrega local',text:'Despachos en la ciudad',buttonText:'Consultar',detailText:'De lunes a viernes.'}]})}/>);
    expect(screen.getByRole('heading',{name:'Atención a empresas'})).toBeInTheDocument();
    const button=screen.getByRole('button',{name:'Consultar'}); button.focus(); fireEvent.click(button);
    const dialog=screen.getByRole('dialog',{name:'Entrega local'});
    expect(within(dialog).getByText('De lunes a viernes.')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByRole('button',{name:'Cerrar información'})).toHaveFocus();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus(); expect(document.body.style.overflow).toBe('');
  });
  it('usa cada destino, el mensaje propio con WhatsApp global y desactiva los enlaces inválidos', () => {
    render(<InformacionSection theme={theme({cards:[
      {id:'a',buttonText:'Ubicación',actionMode:'link',href:'https://maps.example.com/local',newTab:true},
      {id:'b',buttonText:'Asesor',actionMode:'whatsapp',whatsappMessage:'Quiero asesoría'},
      {id:'c',buttonText:'Inválido',actionMode:'link',href:'javascript:alert(1)'},
    ]})}/>);
    expect(screen.getByRole('link',{name:'Ubicación'})).toHaveAttribute('href','https://maps.example.com/local');
    expect(screen.getByRole('link',{name:'Ubicación'})).toHaveAttribute('rel','noopener noreferrer');
    expect(screen.getByRole('link',{name:'Asesor'})).toHaveAttribute('href','https://wa.me/573001234567?text=Quiero%20asesor%C3%ADa');
    expect(screen.getByRole('button',{name:'Inválido'})).toBeDisabled();
    for(const href of ['//evil.example','/\\evil.example','data:text/html,test','https://user:pass@example.com']) expect(safeInfoHref(href)).toBe('');
  });
  it('respeta visibilidad y el destacado por identidad al cambiar el orden', () => {
    const {container,rerender}=render(<InformacionSection theme={theme({glass:{featuredId:'b'},cards:[{id:'b',heading:'Primero'},{id:'a',enabled:false},{id:'c',heading:'Último'}]})}/>);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(container.querySelector('.info-glass-card--featured h3')).toHaveTextContent('Primero');
    rerender(<InformacionSection theme={{sections:[{id:'informacion',enabled:false}]}}/>);
    expect(container).toBeEmptyDOMElement();
  });
  it('guarda textos, acciones, orden y tamaño desde los grupos del panel sin perderlos al normalizar', () => {
    let saved;
    function Harness(){ const [value,setValue]=useState(theme({})); saved=value; return <InfoSectionUI theme={value} setPath={(_,sections)=>setValue({...value,sections})}/>; }
    render(<Harness/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Texto del título'}),{target:{value:'Nuestro servicio'}});
    fireEvent.click(screen.getByRole('button',{name:'Bloques'}));
    fireEvent.click(screen.getByRole('button',{name:'Bloque 2'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Título del bloque'}),{target:{value:'Ayuda en línea'}});
    fireEvent.click(screen.getByRole('button',{name:'← Antes'}));
    fireEvent.click(within(screen.getByRole('navigation',{name:'Opciones del bloque'})).getByRole('button',{name:'Botón'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Acción del botón'}),{target:{value:'link'}});
    fireEvent.change(screen.getByRole('textbox',{name:'Destino del botón'}),{target:{value:'/ayuda'}});
    fireEvent.click(within(screen.getByRole('navigation',{name:'Pasos de edición'})).getByRole('button',{name:/Diseño/}));
    fireEvent.click(within(screen.getByRole('navigation',{name:'Diseño de Información'})).getByRole('button',{name:'Medidas'}));
    fireEvent.change(screen.getByRole('spinbutton',{name:'Ancho máximo (px)'}),{target:{value:'1600'}});
    const section=normalizeInfoSection(saved.sections[0]);
    expect(section.config.cards[0]).toMatchObject({id:'card_2',heading:'Ayuda en línea',actionMode:'link',href:'/ayuda'});
    expect(normalizeInfoGlass(section.config)).toMatchObject({title:'Nuestro servicio',maxWidth:1600,featuredId:'card_2'});
  });
});
