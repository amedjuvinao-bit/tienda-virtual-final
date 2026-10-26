// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import api from "../lib/api";
import ProductDetail from "./ProductDetail";

const { addToCartMock, route } = vi.hoisted(() => ({
  route: {id:"demo-smartphone"},
  addToCartMock: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => route,
  useLocation: () => ({ pathname: `/producto/${route.id}` }),
}));

vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../context/CartContext", () => ({
  useCart: () => ({ addToCart: addToCartMock }),
}));

vi.mock("../context/FavoritesContext", () => ({
  useFavorites: () => ({
    isFavorite: () => false,
    toggleFavorite: vi.fn(),
  }),
}));

vi.mock("../lib/productSeo", () => ({
  applyProductSeo: () => () => {},
}));

vi.mock("../components/product-detail/ProductDetailView", () => ({
  default: ({
    product,
    selectedSize,
    selectedColor,
    setSelectedColor,
    selectedAttributes,
    onVariantAttributeChange,
    onAddToCart,
    inventoryTracked,
    selectedAvailableStock,
    isVariantOptionAvailable, quantity, setQuantity, purchaseUnavailable,config,reviewName,setReviewName,reviewComment,setReviewComment,onSubmitReview,reviewSuccess,
  }) => (
    <div>
      <img
        data-testid="variant-image"
        src={product.image}
        alt={product.title}
      />
      <span data-testid="variant-price">{product.price}</span>
      <span data-testid="variant-size">{selectedSize}</span>
      <span data-testid="variant-color">{selectedColor}</span>
      <span data-testid="variant-ram">{selectedAttributes?.ram}</span>
      <span data-testid="variant-connectivity">
        {selectedAttributes?.conectividad}
      </span>
      <span data-testid="title">{product.title}</span>
      <span data-testid="quantity">{quantity}</span>
      <span data-testid="unavailable">{String(purchaseUnavailable)}</span>
      <span data-testid="config">{JSON.stringify(config)}</span>
      <span data-testid="reviews">{product.reviews?.length||0}</span>
      <span data-testid="review-success">{reviewSuccess}</span>
      <input aria-label="Nombre reseña" value={reviewName} onChange={event=>setReviewName(event.target.value)}/>
      <input aria-label="Comentario reseña" value={reviewComment} onChange={event=>setReviewComment(event.target.value)}/>
      <button onClick={onSubmitReview}>Enviar reseña</button>
      <button onClick={()=>setQuantity(5)}>Cantidad cinco</button>
      <span data-testid="variant-stock">{String(selectedAvailableStock)}</span>
      <span data-testid="gold-available">
        {String(isVariantOptionAvailable?.("color", "Dorado"))}
      </span>
      <button
        type="button"
        onClick={() => setSelectedColor("Dorado")}
      >
        Elegir dorado
      </button>
      <button
        type="button"
        onClick={() => onVariantAttributeChange("ram", "12 GB")}
      >
        Elegir 12 GB RAM
      </button>
      <button data-testid="add-variant" type="button" onClick={onAddToCart}>
        Añadir variante
      </button>
    </div>
  ),
}));

const DEMO_PRODUCT = {
  _id: "demo-smartphone",
  title: "DEMO Smartphone X Pro",
  image: "https://example.com/general.jpg",
  images: ["https://example.com/general-gallery.jpg"],
  price: 1899000,
  sizes: ["128 GB", "256 GB"],
  colors: ["#111827", "#d4af37"],
  variantAxes: [
    { key: "capacidad", label: "Capacidad", values: ["128 GB", "256 GB"] },
    { key: "ram", label: "RAM", values: ["8 GB", "12 GB"] },
    { key: "color", label: "Color", values: ["Negro", "Dorado"] },
    { key: "conectividad", label: "Conectividad", values: ["5G", "Wi-Fi"] },
  ],
  variants: [
    {
      variantKey: "v2__capacidad=128%20gb__color=negro__conectividad=5g__ram=8%20gb",
      size: "128 GB",
      color: "#111827",
      attributes: [
        { key: "capacidad", label: "Capacidad", value: "128 GB" },
        { key: "ram", label: "RAM", value: "8 GB" },
        { key: "color", label: "Color", value: "Negro" },
        { key: "conectividad", label: "Conectividad", value: "5G" },
      ],
      price: 1899000,
      image: "https://example.com/128-negro.jpg",
      images: ["https://example.com/128-negro-gallery.jpg"],
      active: true,
      sortOrder: 0,
    },
    {
      variantKey: "v2__capacidad=256%20gb__color=dorado__conectividad=wi-fi__ram=12%20gb",
      size: "256 GB",
      color: "#d4af37",
      attributes: [
        { key: "capacidad", label: "Capacidad", value: "256 GB" },
        { key: "ram", label: "RAM", value: "12 GB" },
        { key: "color", label: "Color", value: "Dorado" },
        { key: "conectividad", label: "Conectividad", value: "Wi-Fi" },
      ],
      price: 2249000,
      image: "https://example.com/256-dorado.jpg",
      images: ["https://example.com/256-dorado-gallery.jpg"],
      active: true,
      sortOrder: 1,
    },
  ],
};

beforeEach(()=>{route.id='demo-smartphone';addToCartMock.mockClear();api.get.mockReset();api.post.mockReset();});
afterEach(()=>cleanup());

describe("ProductDetail con variantes", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    addToCartMock.mockClear();
    route.id="demo-smartphone";
    api.post.mockReset();
    api.get.mockImplementation(async (url) => {
      if (url === "/api/pages") {
        return { data: [] };
      }

      return { data: DEMO_PRODUCT };
    });
  });

  it("cambia a la foto, precio y combinación válida de la variante elegida", async () => {
    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/128-negro.jpg"
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Elegir dorado" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/256-dorado.jpg"
      );
      expect(screen.getByTestId("variant-price")).toHaveTextContent(
        "2249000"
      );
      expect(screen.getByTestId("variant-size")).toHaveTextContent(
        "256 GB"
      );
      expect(screen.getByTestId("variant-color")).toHaveTextContent(
        "Dorado"
      );
    });
  });

  it("selecciona una combinación completa de cuatro atributos", async () => {
    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-ram")).toHaveTextContent("8 GB");
      expect(screen.getByTestId("variant-connectivity")).toHaveTextContent("5G");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Elegir 12 GB RAM" })
    );

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/256-dorado.jpg"
      );
      expect(screen.getByTestId("variant-price")).toHaveTextContent("2249000");
      expect(screen.getByTestId("variant-ram")).toHaveTextContent("12 GB");
      expect(screen.getByTestId("variant-connectivity")).toHaveTextContent("Wi-Fi");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Añadir variante" })
    );

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variantKey: "v2__capacidad=256%20gb__color=gold__conectividad=wi-fi__ram=12%20gb",
        variantAttributes: expect.arrayContaining([
          expect.objectContaining({ key: "ram", value: "12 GB" }),
          expect.objectContaining({
            key: "conectividad",
            value: "Wi-Fi",
          }),
        ]),
      })
    );
  });

  it("conserva la clave canonica aunque muestre la etiqueta amigable del color", async () => {
    api.get.mockImplementation(async (url) => {
      if (url === "/api/pages") return { data: [] };

      return {
        data: {
          _id: "legacy-dress",
          title: "Vestido legado",
          image: "https://example.com/legacy.jpg",
          price: 200000,
          sizes: ["4"],
          colors: ["royalblue"],
          variants: [],
        },
      };
    });

    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-size")).toHaveTextContent("4");
      expect(screen.getByTestId("variant-color")).toHaveTextContent("Azul rey");
    });

    fireEvent.click(screen.getByTestId("add-variant"));

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "Azul rey",
        colorValue: "royalblue",
        variantId: "4__royalblue",
        variantKey: "4__royalblue",
        variantLabel: "4 / Azul rey",
      })
    );
  });

  it("elige inicialmente una variante disponible y expone las opciones agotadas", async () => {
    api.get.mockImplementation(async (url) => {
      if (url === "/api/pages") return { data: [] };
      return {
        data: {
          ...DEMO_PRODUCT,
          inventoryTracked: true,
          availableStock: 2,
          variants: [
            { ...DEMO_PRODUCT.variants[0], availableStock: 0 },
            { ...DEMO_PRODUCT.variants[1], availableStock: 2 },
          ],
        },
      };
    });

    render(<ProductDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("variant-image")).toHaveAttribute(
        "src",
        "https://example.com/256-dorado.jpg"
      );
      expect(screen.getByTestId("variant-stock")).toHaveTextContent("2");
      expect(screen.getByTestId("gold-available")).toHaveTextContent("true");
    });
  });
});


it('hereda el precio del producto cuando la variante no define otro y respeta un precio cero explícito',async()=>{
  api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{...DEMO_PRODUCT,variants:[{...DEMO_PRODUCT.variants[0],price:null},{...DEMO_PRODUCT.variants[1],price:0}]}}));
  render(<ProductDetail/>);
  await waitFor(()=>expect(screen.getByTestId('variant-price')).toHaveTextContent('1899000'));
  fireEvent.click(screen.getByRole('button',{name:'Elegir dorado'}));
  await waitFor(()=>expect(screen.getByTestId('variant-price')).toHaveTextContent(/^0$/));
  fireEvent.click(screen.getByTestId('add-variant'));
  expect(addToCartMock).toHaveBeenCalledWith(expect.objectContaining({price:0,unitPrice:0}));
});
it('ajusta la cantidad al stock de la variante nueva antes de enviarla al carrito',async()=>{
  api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{...DEMO_PRODUCT,inventoryTracked:true,variants:DEMO_PRODUCT.variants.map((variant,index)=>({...variant,availableStock:index?2:6}))}}));
  render(<ProductDetail/>);await screen.findByTestId('quantity');
  fireEvent.click(screen.getByRole('button',{name:'Cantidad cinco'}));
  expect(screen.getByTestId('quantity')).toHaveTextContent('5');
  fireEvent.click(screen.getByRole('button',{name:'Elegir 12 GB RAM'}));
  expect(screen.getByTestId('quantity')).toHaveTextContent('2');
  fireEvent.click(screen.getByTestId('add-variant'));
  expect(addToCartMock).toHaveBeenCalledWith(expect.objectContaining({quantity:2,price:2249000}));
});
it('permite comprar un producto simple con stock y bloquea productos sin variantes activas',async()=>{
  api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{_id:'simple',title:'Servicio',price:100000,inventoryTracked:true,availableStock:3,variants:[]}}));
  const view=render(<ProductDetail/>);await screen.findByTestId('quantity');
  fireEvent.click(screen.getByRole('button',{name:'Cantidad cinco'}));fireEvent.click(screen.getByTestId('add-variant'));
  expect(addToCartMock).toHaveBeenCalledWith(expect.objectContaining({quantity:3,price:100000}));view.unmount();addToCartMock.mockClear();
  api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{...DEMO_PRODUCT,variants:DEMO_PRODUCT.variants.map(variant=>({...variant,active:false}))}}));
  render(<ProductDetail/>);await screen.findByTestId('unavailable');
  expect(screen.getByTestId('unavailable')).toHaveTextContent('true');fireEvent.click(screen.getByTestId('add-variant'));expect(addToCartMock).not.toHaveBeenCalled();
});
it('ignora una respuesta atrasada después de abrir otro producto',async()=>{
  let complete;api.get.mockImplementation(url=>url==='/api/pages'?Promise.resolve({data:[]}):url.includes('nuevo')?Promise.resolve({data:{...DEMO_PRODUCT,_id:'nuevo',title:'Producto nuevo'}}):new Promise(resolve=>{complete=resolve;}));
  const view=render(<ProductDetail/>);route.id='nuevo';view.rerender(<ProductDetail/>);
  await waitFor(()=>expect(screen.getByTestId('title')).toHaveTextContent('Producto nuevo'));
  complete({data:{...DEMO_PRODUCT,title:'Respuesta antigua'}});
  await waitFor(()=>expect(screen.getByTestId('title')).toHaveTextContent('Producto nuevo'));
});
it('espera la configuración guardada y respeta el encabezado y pie desactivados',async()=>{
  let complete;api.get.mockImplementation(url=>url==='/api/pages'?new Promise(resolve=>{complete=resolve;}):Promise.resolve({data:DEMO_PRODUCT}));
  render(<ProductDetail/>);expect(screen.getByLabelText('Cargando producto')).toHaveAttribute('aria-busy','true');expect(screen.getByRole('status',{name:'Cargando tienda'})).toBeInTheDocument();expect(screen.queryByTestId('title')).not.toBeInTheDocument();
  complete({data:[{pageType:'product-detail',enabled:true,useHeader:false,useFooter:false,productDetailConfig:{subtitle:'Guardado'}}]});
  await screen.findByTestId('config');expect(JSON.parse(screen.getByTestId('config').textContent)).toMatchObject({showHeader:false,showFooter:false,subtitle:'Guardado'});
});
it('distingue un fallo de conexión y permite reintentar',async()=>{
  let fail=true;api.get.mockImplementation(async url=>{if(url==='/api/pages')return {data:[]};if(fail)throw {response:{status:503}};return {data:DEMO_PRODUCT};});
  render(<ProductDetail/>);await screen.findByRole('alert');fail=false;fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));await screen.findByTestId('title');
});
it('evita reseñas duplicadas y no las mezcla si cambia el producto mientras se envían',async()=>{
  let complete;api.post.mockReturnValue(new Promise(resolve=>{complete=resolve;}));
  api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{...DEMO_PRODUCT,_id:url.includes('nuevo')?'nuevo':DEMO_PRODUCT._id,reviews:[]}}));
  const view=render(<ProductDetail/>);await screen.findByTestId('title');
  fireEvent.change(screen.getByLabelText('Nombre reseña'),{target:{value:'Ana'}});fireEvent.change(screen.getByLabelText('Comentario reseña'),{target:{value:'Comentario'}});
  fireEvent.click(screen.getByRole('button',{name:'Enviar reseña'}));fireEvent.click(screen.getByRole('button',{name:'Enviar reseña'}));expect(api.post).toHaveBeenCalledTimes(1);
  route.id='nuevo';view.rerender(<ProductDetail/>);await screen.findByTestId('reviews');complete({data:{reviews:[{name:'Ana',comment:'Comentario'}]}});
  await waitFor(()=>expect(screen.getByTestId('reviews')).toHaveTextContent(/^0$/));expect(screen.getByTestId('review-success')).toBeEmptyDOMElement();
});


it('envía el valor visual real de un color guardado como objeto',async()=>{
 api.get.mockImplementation(async url=>({data:url==='/api/pages'?[]:{_id:'color-object',title:'Producto',price:50000,sizes:['M'],colors:[{name:'Verde personalizado',hex:'#33aa77'}],variants:[]}}));
 render(<ProductDetail/>);await screen.findByTestId('variant-color');fireEvent.click(screen.getByTestId('add-variant'));
 expect(addToCartMock).toHaveBeenCalledWith(expect.objectContaining({color:'Verde personalizado',colorValue:'#33aa77'}));
});
