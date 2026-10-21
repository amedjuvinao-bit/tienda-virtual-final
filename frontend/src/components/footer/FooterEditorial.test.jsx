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
  it('recupera los botones de cristal del modelo y mantiene accesibles los destinos y los logos personalizados',()=>{
    const footer={logoUrl:'/mi-logo.png',instagram:'https://instagram.com/demo',instagramIcon:'/icono-anterior.png'};
    const {rerender}=render(<FooterSection theme={makeTheme(footer)}/>);
    expect(screen.getByRole('img',{name:'Logo de la tienda'})).toHaveAttribute('src','/mi-logo.png');
    expect(screen.getByRole('link',{name:'Instagram'}).querySelector('img')).toBeNull();
    expect(screen.getByRole('link',{name:'Instagram'})).toHaveAttribute('title','Instagram');
    expect(document.querySelector('.footer-ed__social-dock')).toHaveAttribute('data-presentation','glass');
    expect(document.querySelector('.footer-ed__social-label')).toBeNull();
    rerender(<FooterSection theme={makeTheme({...footer,editorial:{socialPresentation:'medallions',socialButtonColor:'#801c3c',socialIconColor:'#fff5ea'}})}/>);
    expect(document.querySelector('.footer-ed__social-dock')).toHaveAttribute('data-presentation','glass');
    expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-social-ink')).toBe('#ac6b36');
    expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-social-button')).toBe('#f3c4ba');
    rerender(<FooterSection theme={makeTheme({...footer,editorial:{socialPresentation:'custom'}})}/>);
    expect(screen.getByRole('link',{name:'Instagram'}).querySelector('img')).toHaveAttribute('src','/icono-anterior.png');
    rerender(<FooterSection theme={makeTheme({...footer,editorial:{brandName:'Mi tienda',brandMode:'text',socialPresentation:'minimal'}})}/>);
    expect(screen.getByText('Mi tienda',{selector:'.footer-ed__brand-name'})).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Instagram'}).querySelector('img')).toBeNull();
  });
  it('permite cambiar el acabado y los colores sin modificar la marca ni los destinos sociales',()=>{
    let saved;
    function Harness(){const [theme,setTheme]=useState(makeTheme({editorial:{brandName:'Mi negocio'},instagram:'https://instagram.com/demo',instagramIcon:'/mi-icono.png'}));saved=theme;return <FooterPanel theme={theme} setPath={(path,value)=>setTheme(old=>({...old,footer:{...old.footer,[path.slice(7)]:value}}))}/>;}
    render(<Harness/>);
    const content=within(screen.getByRole('navigation',{name:'Contenido del footer'}));
    fireEvent.click(content.getByRole('button',{name:'Redes'}));
    expect(screen.getByRole('combobox',{name:'Estilo de los iconos sociales'})).toHaveValue('glass');
    fireEvent.change(screen.getByRole('textbox',{name:'Color del relieve de los símbolos: código hexadecimal'}),{target:{value:'#a27842'}});
    expect(saved.footer.editorial).toMatchObject({socialPresentation:'glass',socialIconColor:'#a27842'});
    fireEvent.change(screen.getByRole('combobox',{name:'Estilo de los iconos sociales'}),{target:{value:'custom'}});
    expect(saved.footer.editorial.socialPresentation).toBe('custom');
    fireEvent.click(content.getByRole('button',{name:'Marca de agua'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Acabado del nombre grande'}),{target:{value:'engraved'}});
    expect(saved.footer.editorial.watermarkStyle).toBe('engraved');
    expect(saved.footer).toMatchObject({instagram:'https://instagram.com/demo',instagramIcon:'/mi-icono.png',editorial:{brandName:'Mi negocio'}});
  });
  it('ajusta el color y toda la transparencia desde una sola pestaña y conserva los cambios al recargar',async()=>{
    let saved;
    function Harness({initial}){const [theme,setTheme]=useState(initial);saved=theme;return <FooterPanel theme={theme} setPath={(path,value)=>setTheme(old=>({...old,footer:{...old.footer,[path.slice(7)]:value}}))}/>;}
    const view=render(<Harness initial={makeTheme({editorial:{brandName:'Mi negocio'}})}/>);
    const openWatermark=()=>fireEvent.click(within(screen.getByRole('navigation',{name:'Contenido del footer'})).getByRole('button',{name:'Marca de agua'}));
    openWatermark();
    const color=screen.getByRole('textbox',{name:'Color de la marca de agua: código hexadecimal'});
    fireEvent.change(color,{target:{value:'#123456'}});
    const slider=screen.getByRole('slider',{name:'Transparencia de la marca de agua'});
    fireEvent.change(slider,{target:{value:'65'}});
    expect(saved.footer.editorial).toMatchObject({watermarkColor:'#123456',watermarkOpacity:35});
    await waitFor(()=>expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-watermark-alpha')).toBe('0.35'));
    expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-signature-color')).toBe('#123456');
    const persisted=JSON.parse(JSON.stringify(saved));view.unmount();render(<Harness initial={persisted}/>);openWatermark();
    expect(screen.getByRole('textbox',{name:'Color de la marca de agua: código hexadecimal'})).toHaveValue('#123456');
    const reloadedSlider=screen.getByRole('slider',{name:'Transparencia de la marca de agua'});
    expect(reloadedSlider).toHaveValue('65');
    fireEvent.change(reloadedSlider,{target:{value:'0'}});expect(saved.footer.editorial.watermarkOpacity).toBe(100);
    await waitFor(()=>expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-watermark-alpha')).toBe('1'));
    fireEvent.change(reloadedSlider,{target:{value:'100'}});expect(saved.footer.editorial.watermarkOpacity).toBe(0);
    await waitFor(()=>expect(document.querySelector('.footer-ed').style.getPropertyValue('--fe-watermark-alpha')).toBe('0'));
  });
  it('reemplaza las letras de prueba de la captura por textos comerciales y toma la identidad real de la tienda',()=>{
    const footer={subscribeText:'ASDADASDASDASD',column1Title:'ERWRWERWERWERWERW',column2Title:'WERWERWERWERWER',column3Title:'WRWERWERWERWER',editorial:{brandName:'Tu marca',brandMode:'text',watermarkText:'TU MARCA',socialIconStyle:'relief'},copyright:'© Tu marca · Todos los derechos reservados.'};
    render(<FooterSection theme={{...makeTheme(footer),header:{logoLight:'/marca-real.png'}}} store={{name:'Mi negocio'}}/>);
    expect(screen.getByRole('img',{name:'Mi negocio'})).toHaveAttribute('src','/marca-real.png');
    expect(screen.getByText('Conoce nuestras novedades, nuevas colecciones y promociones.')).toBeInTheDocument();
    for(const title of ['Nuestra tienda','Atención al cliente','Información legal'])expect(screen.getByRole('button',{name:title})).toBeInTheDocument();
    expect(screen.getByText('© Mi negocio · Todos los derechos reservados.')).toBeInTheDocument();
    expect(document.querySelector('.footer-ed__watermark')).toHaveTextContent('MI NEGOCIO');
    expect(document.body).not.toHaveTextContent(/TU MARCA|ASDADASDASDASD|ERWRWERWER/);
  });
  it('mantiene el mismo nombre del negocio en la vista previa del panel',async()=>{
    let saved;
    function Harness(){const [theme,setTheme]=useState({...makeTheme({editorial:{brandName:'Tu marca',brandMode:'text'}}),header:{logoLight:'/marca-real.png'}});saved=theme;return <FooterPanel theme={theme} store={{name:'Negocio global'}} setPath={(path,value)=>setTheme(old=>({...old,footer:{...old.footer,[path.slice(7)]:value}}))}/>;}
    render(<Harness/>);
    expect(await screen.findByRole('img',{name:'Negocio global'})).toHaveAttribute('src','/marca-real.png');
    fireEvent.click(within(screen.getByRole('navigation',{name:'Contenido del footer'})).getByRole('button',{name:'Marca'}));
    expect(screen.getByRole('textbox',{name:'Nombre de la marca'})).toHaveValue('Negocio global');
    fireEvent.change(screen.getByRole('textbox',{name:'Nombre de la marca'}),{target:{value:'Negocio actualizado'}});
    expect(screen.getByRole('img',{name:'Negocio actualizado'})).toHaveAttribute('src','/marca-real.png');
    expect(saved.footer.editorial.brandMode).toBe('store');
  });
  it('no inventa una marca cuando el negocio aún no tiene nombre o logo',()=>{
    render(<FooterSection theme={null}/>);
    expect(document.querySelector('.footer-ed__brand')).toBeNull();
    expect(document.querySelector('.footer-ed__watermark')).toBeNull();
    expect(screen.getByText('© Todos los derechos reservados.')).toBeInTheDocument();
  });
  it('recupera la apariencia aprobada sin borrar contenido, enlaces ni imágenes guardadas',()=>{
    let saved;
    const initial={editorial:{brandName:'Mi negocio',brandMode:'image',socialIconStyle:'custom',titleFont:'Georgia, serif',depth:1},logoUrl:'/mi-logo.png',instagramIcon:'/mi-icono.png',column1Title:'Descubre',column1Links:[{label:'Mi catálogo',href:'/catalogo'}]};
    function Harness(){const [theme,setTheme]=useState(makeTheme(initial));saved=theme;return <FooterPanel theme={theme} setPath={(path,value)=>setTheme(old=>({...old,footer:{...old.footer,[path.slice(7)]:value}}))}/>;}
    render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Aplicar apariencia del modelo aprobado'}));
    expect(saved.footer.editorial).toMatchObject({brandName:'Mi negocio',brandMode:'store',socialIconStyle:'custom',depth:12});
    expect(saved.footer.editorial.titleFont).toContain('Bodoni');
    expect(saved.footer).toMatchObject({logoUrl:'/mi-logo.png',instagramIcon:'/mi-icono.png',column1Title:'Descubre',column1Links:initial.column1Links});
    expect(screen.getByText(/Apariencia aplicada/)).toHaveTextContent('Guarda los cambios');
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
