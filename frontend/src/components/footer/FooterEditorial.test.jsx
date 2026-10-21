import React, {useState} from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FooterSection from '../FooterSection';
import FooterPanel from '../../admin/appearance/footer/FooterPanel';
import api from '../../lib/api';

afterEach(()=>{cleanup();vi.restoreAllMocks();});
const makeTheme=footer=>({sections:[],footer});
describe('footer Firma editorial',()=>{
  it('conserva contenido y enlaces propios, oculta redes sin destino y cambia el estado de cada acordeón',()=>{
    render(<FooterSection theme={makeTheme({editorial:{brandName:'Marca global'},subscribeText:'Noticias de nuestro negocio.',column1Title:'Descubre',column1Links:[{label:'Catálogo real',href:'/catalogo'},{label:'Inválido',href:'javascript:alert(1)'}],instagram:'https://instagram.com/mi.cuenta',facebook:'',copyright:'Mi texto legal'})}/>);
    expect(screen.getByText('Marca global',{selector:'.footer-ed__brand-name'})).toBeInTheDocument();
    expect(screen.getByText('Noticias de nuestro negocio.')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Catálogo real'})).toHaveAttribute('href','/catalogo');
    expect(screen.queryByRole('link',{name:'Inválido'})).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Instagram'})).toHaveAttribute('href','https://instagram.com/mi.cuenta');
    expect(screen.queryByRole('link',{name:'Facebook'})).not.toBeInTheDocument();
    const accordion=screen.getByRole('button',{name:'Descubre'});expect(accordion).toHaveAttribute('aria-expanded','false');fireEvent.click(accordion);expect(accordion).toHaveAttribute('aria-expanded','true');
  });
  it('confirma la suscripción solo después del guardado y muestra un error cuando falla',async()=>{
    const post=vi.spyOn(api,'post').mockResolvedValueOnce({data:{ok:true}}).mockRejectedValueOnce(new Error('offline'));
    render(<FooterSection theme={makeTheme({})}/>);
    const email=screen.getByRole('textbox',{name:'Correo electrónico'}), submit=screen.getByRole('button',{name:'Suscribirme'});
    fireEvent.change(email,{target:{value:' USER@EXAMPLE.COM '}});fireEvent.submit(submit.closest('form'));
    await screen.findByRole('status');expect(post).toHaveBeenCalledWith('/api/newsletter/subscribe',{email:'user@example.com',consent:true});
    expect(email).toHaveValue('');
    fireEvent.change(email,{target:{value:'other@example.com'}});fireEvent.submit(submit.closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar tu correo');
  });
  it('prueba la suscripción en el editor sin registrar datos',async()=>{
    const post=vi.spyOn(api,'post');render(<FooterSection theme={makeTheme({})} preview/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Correo electrónico'}),{target:{value:'demo@example.com'}});
    fireEvent.submit(screen.getByRole('form',{name:'Suscripción a novedades'}));
    expect(await screen.findByRole('status')).toHaveTextContent('Vista previa');expect(post).not.toHaveBeenCalled();
  });
  it('usa la firma y el relieve del modelo aunque existan imágenes del footer anterior',()=>{
    const footer={logoUrl:'/mi-logo.png',instagram:'https://instagram.com/demo',instagramIcon:'/icono-anterior.png'};
    const {rerender}=render(<FooterSection theme={makeTheme(footer)}/>);
    expect(screen.getByText('Tu marca',{selector:'.footer-ed__brand-name'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Instagram'}).querySelector('img')).toBeNull();
    rerender(<FooterSection theme={makeTheme({...footer,editorial:{brandMode:'image',socialIconStyle:'custom'}})}/>);
    expect(screen.getByRole('img',{name:'Tu marca'})).toHaveAttribute('src','/mi-logo.png');
    expect(screen.getByRole('link',{name:'Instagram'}).querySelector('img')).toHaveAttribute('src','/icono-anterior.png');
  });
  it('recupera la apariencia aprobada sin borrar contenido, enlaces ni imágenes guardadas',()=>{
    let saved;
    const initial={editorial:{brandName:'Mi negocio',brandMode:'image',socialIconStyle:'custom',titleFont:'Georgia, serif',depth:1},logoUrl:'/mi-logo.png',instagramIcon:'/mi-icono.png',column1Title:'Descubre',column1Links:[{label:'Mi catálogo',href:'/catalogo'}]};
    function Harness(){const [theme,setTheme]=useState(makeTheme(initial));saved=theme;return <FooterPanel theme={theme} setPath={(path,value)=>setTheme(old=>({...old,footer:{...old.footer,[path.slice(7)]:value}}))}/>;}
    render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Aplicar apariencia del modelo aprobado'}));
    expect(saved.footer.editorial).toMatchObject({brandName:'Mi negocio',brandMode:'text',socialIconStyle:'relief',depth:12});
    expect(saved.footer.editorial.titleFont).toContain('Bodoni');
    expect(saved.footer).toMatchObject({logoUrl:'/mi-logo.png',instagramIcon:'/mi-icono.png',column1Title:'Descubre',column1Links:initial.column1Links});
    expect(screen.getByText(/Apariencia aplicada:/)).toHaveTextContent('Guarda los cambios');
  });
  it('edita la marca, los enlaces y el material por grupos y muestra los tres dispositivos',async()=>{
    let saved;
    function Harness(){const [theme,setTheme]=useState(makeTheme({}));saved=theme;return <FooterPanel theme={theme} setPath={(path,value)=>setTheme(old=>{const next=structuredClone(old);const parts=path.split('.');let current=next;parts.slice(0,-1).forEach(key=>{current[key]??={};current=current[key];});current[parts.at(-1)]=value;return next;})}/>;}
    render(<Harness/>);
    const content=screen.getByRole('navigation',{name:'Contenido del footer'});fireEvent.click(within(content).getByRole('button',{name:'Marca'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Nombre de la marca'}),{target:{value:'Mi negocio'}});
    fireEvent.click(within(content).getByRole('button',{name:'Enlaces'}));fireEvent.change(screen.getByRole('textbox',{name:'Destino del enlace'}),{target:{value:'/mi-catalogo'}});
    fireEvent.click(within(screen.getByRole('navigation',{name:'Pasos de edición'})).getByRole('button',{name:/Diseño/}));
    fireEvent.click(within(screen.getByRole('navigation',{name:'Diseño del footer'})).getByRole('button',{name:'Cristal'}));
    fireEvent.change(screen.getByRole('spinbutton',{name:'Profundidad de las capas (px)'}),{target:{value:'22'}});
    expect(saved.footer.editorial).toMatchObject({brandName:'Mi negocio',depth:22});expect(saved.footer.column1Links[0].href).toBe('/mi-catalogo');
    const devices=within(screen.getByRole('group',{name:'Dispositivo de vista previa'}));
    for(const label of ['Vista móvil','Vista tablet','Vista escritorio']){fireEvent.click(devices.getByRole('button',{name:label,exact:true}));expect(devices.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');}
    await waitFor(()=>expect(screen.getByText('Mi negocio',{selector:'.footer-ed__brand-name'})).toBeInTheDocument());
  });
});
