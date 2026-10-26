import React from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { MemoryRouter,Routes,Route } from 'react-router-dom';
import FavoritesPageView from './FavoritesPageView';
vi.mock('../Header',()=>({default:()=> <header>Encabezado público</header>}));
vi.mock('../FooterSection',()=>({default:()=> <footer>Pie público</footer>}));
vi.mock('../WhatsAppButton',()=>({default:()=>null}));
const item={productId:'p1',title:'Artículo',image:'/sample.png',price:90000,variantKey:'v2__capacidad=128%20gb',variantAttributes:[{key:'capacidad',label:'Capacidad',value:'128 GB'}],current:{valid:true,price:95000,variantKey:'v2__capacidad=128%20gb'}};
const mount=ui=>render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(cleanup);
it('mantiene variantes separadas y usa su identidad completa al quitar y agregar',async()=>{
  const remove=vi.fn(),add=vi.fn();
  const second={...item,variantKey:'v2__capacidad=256%20gb',variantAttributes:[{key:'capacidad',label:'Capacidad',value:'256 GB'}]};
  const {container}=mount(<FavoritesPageView page={{useHeader:false,useFooter:false}} favoritesState={{favorites:[item,second],removeFromFavorites:remove}} cartState={{addToCart:add}}/>);
  expect(screen.queryByText('Encabezado público')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.favorite-card')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'Quitar de favoritos: Artículo · Capacidad: 128 GB'}));
  expect(remove).toHaveBeenCalledWith(expect.objectContaining({productId:'p1',variantKey:'v2__capacidad=128%20gb'}));
  const card=screen.getByText('Capacidad: 128 GB').closest('.favorite-card');
  fireEvent.click(within(card).getByRole('button',{name:'Agregar al carrito'}));
  expect(add).toHaveBeenCalledWith(expect.objectContaining({_id:'p1',variantKey:'v2__capacidad=128%20gb',price:95000,quantity:1}));
});
it('busca, ordena por precio vigente y permite limpiar sin modificar la lista guardada',()=>{
  const second={...item,productId:'p2',title:'Otro producto',current:{valid:true,price:1000}};
  const {container}=mount(<FavoritesPageView favoritesState={{favorites:[item,second]}}/>);
  fireEvent.change(screen.getByRole('combobox',{name:'Ordenar por'}),{target:{value:'price-asc'}});
  expect(container.querySelector('.favorite-card h2')).toHaveTextContent('Otro producto');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'inexistente'}});
  expect(screen.getByText('No encontramos productos con esa búsqueda.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Limpiar búsqueda'}));
  expect(container.querySelectorAll('.favorite-card')).toHaveLength(2);
});
it('bloquea productos no disponibles y no marca una compra fallida como agregada',async()=>{
  const {rerender}=mount(<FavoritesPageView favoritesState={{favorites:[{...item,current:{valid:false}}]}}/>);
  expect(screen.getByRole('button',{name:'Agregar al carrito'})).toBeDisabled();
  rerender(<MemoryRouter><FavoritesPageView favoritesState={{favorites:[item]}} cartState={{addToCart:vi.fn().mockRejectedValue(new Error('503'))}}/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Agregar al carrito'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo agregar');
  expect(screen.getByRole('button',{name:'Agregar al carrito'})).toHaveAttribute('aria-pressed','false');
});
it('los productos con opciones van al detalle y nunca se agregan sin selección',()=>{
  const add=vi.fn();
  render(<MemoryRouter><Routes><Route path="/" element={<FavoritesPageView favoritesState={{favorites:[{...item,current:{valid:true,requiresSelection:true,price:90000}}]}} cartState={{addToCart:add}}/>}/><Route path="/producto/p1" element={<h1>Elegir opciones</h1>}/></Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Seleccionar opciones'}));
  expect(screen.getByRole('heading',{name:'Elegir opciones'})).toBeInTheDocument();expect(add).not.toHaveBeenCalled();
});
it('muestra errores recuperables, imagen de respaldo y respeta página inactiva',()=>{
  const retry=vi.fn();const {container}=mount(<FavoritesPageView favoritesState={{favorites:[item],syncError:true,error:'Error de sincronización',syncFavorites:retry}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(retry).toHaveBeenCalledOnce();
  fireEvent.error(container.querySelector('.favorite-card img'));expect(container.querySelector('.favorite-card img')).toHaveAttribute('src','/placeholder.png');
  cleanup();mount(<FavoritesPageView page={{enabled:false}} favoritesState={{favorites:[item]}}/>);
  expect(screen.queryByRole('button',{name:'Agregar al carrito'})).not.toBeInTheDocument();
});
