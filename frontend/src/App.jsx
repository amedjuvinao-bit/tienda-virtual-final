import "react-toastify/dist/ReactToastify.css";
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import ApiProbe from "./admin/ApiProbe";

// 🔥 API del tema y función que aplica el tema
import { fetchSiteSettings } from "./theme/siteSettingsApi";
import { applyTheme } from "./theme/applyTheme";
import { normalizeGlobalConfig } from "./admin/appearance/general/generalHelpers";

// Componentes globales
import Header from "./components/Header";
import FooterSection from "./components/FooterSection";
import ScrollButton from "./components/ScrollButton";
import WhatsAppButton from "./components/WhatsAppButton";
import GlobalPageLoader from "./components/GlobalPageLoader";

// Páginas principales
import ProductDetail from "./pages/ProductDetail";
import Login from "./admin/Login";
import ForgotPasswordPage from "./admin/ForgotPasswordPage";
import ResetPasswordPage from "./admin/ResetPasswordPage";
import GraciasPage from "./pages/GraciasPage";
import FormularioProducto from "./admin/FormularioProducto";
import DynamicPage from "./pages/DynamicPage";

// Componentes de la HomePage
import CarouselBanner from "./components/CarouselBanner";
import TrendingSection from "./components/TrendingSection";
import LookSection from "./components/LookSection";
import ComplementosLook from "./components/ComplementosLook";
import CategoriasSection from "./components/CategoriasSection";
import InstagramSection from "./components/InstagramSection";
import TiktokSection from "./components/TiktokSection";
import InformacionSection from "./components/InformacionSection.jsx";
import CheckoutPage from "./pages/CheckoutPage";

// Autenticación
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

// Panel de administración
import AdminLayout from "./admin/AdminLayout";
import Dashboard from "./admin/Dashboard";
import ProductosAdmin from "./admin/ProductosAdmin";
import PagesAdmin from "./admin/pages/PagesAdmin";
import PageEditor from "./admin/pages/PageEditor";
import CatalogPageEditor from "./admin/pages/CatalogPageEditor";
import ProductDetailPageEditor from "./admin/pages/ProductDetailPageEditor";
import CartPageEditor from "./admin/pages/CartPageEditor";
import CheckoutPageEditor from "./admin/pages/CheckoutPageEditor";
import ThanksPageEditor from "./admin/pages/ThanksPageEditor";
import FavoritesPageEditor from "./admin/pages/FavoritesPageEditor";
import NotFoundPageEditor from "./admin/pages/NotFoundPageEditor";
import ConfiguracionPage from "./admin/ConfiguracionPage";

// Admin: carritos y favoritos
import CarritosAdmin from "./admin/CarritosAdmin";
import FavoritosAdmin from "./admin/FavoritosAdmin";

// Admin: órdenes
import OrdersAdmin from "./admin/OrdersAdmin";

// ⚙️ NUEVO: página de Apariencia
import AppearancePage from "./admin/AppearancePage";

// Contenedor dentro de la página Carrito de compras
import { CartProvider } from "./context/CartContext.jsx";

// Página 404
import NotFound from "./pages/NotFound";

// Página Carrito de compras
import Carrito from "./pages/Carrito";

// Página Favoritos (cliente)
import Favoritos from "./pages/Favoritos";

// Nuevo contexto para favoritos
import { FavoritesProvider } from "./context/FavoritesContext.jsx";

// ✅ Key/evento que ya estás usando en AppearancePage.jsx
const RB_SETTINGS_TICK_KEY = "rb_site_settings_tick";

// ✅ Solo permitimos secciones “diseñadas” (las que ya existen en tu Home)
const ALLOWED_SECTION_IDS = new Set([
  "banner",
  "tendencia",
  "look",
  "complementos",
  "categorias",
  "instagram",
  "tiktok",
  "informacion",
]);

// Helpers (home dinámica por secciones)
const FALLBACK_INSTA_POSTS = [
  {
    link: "https://www.instagram.com/reel/DBNciDousld/",
    thumb: "/SeccionInstagram/Imgminiatura1.png",
  },
  {
    link: "https://www.instagram.com/p/DBHSxzsP9RY/",
    thumb: "/SeccionInstagram/Imgminiatura3.png",
  },
  {
    link: "https://www.instagram.com/rosaboutique33/p/DBNd9G9uesi/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura2.png",
  },
  {
    link: "https://www.instagram.com/rosaboutique33/p/DBNgXtWuZIC/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura4.png",
  },
  {
    link: "https://www.instagram.com/p/DBNd9G9uesi/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura5.png",
  },
  {
    link: "https://www.instagram.com/p/C0Nt2U8uKWl/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura6.png",
  },
];

const FALLBACK_TIKTOK_POSTS = [
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7425748273320725765",
    thumb: "/SeccionTikTok/BLANCO.jpg",
  },
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7315550010672680197",
    thumb: "/SeccionTikTok/COMPLEMENTO.JPG",
  },
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7425660258074332422",
    thumb: "/SeccionTikTok/ROJO.JPG",
  },
];

function normalizeSections(theme) {
  const arr = Array.isArray(theme?.sections) ? theme.sections : [];
  return arr
    .map((s) => ({
      id: typeof s?.id === "string" ? s.id.trim() : "",
      name: typeof s?.name === "string" ? s.name : "",
      enabled: typeof s?.enabled === "boolean" ? s.enabled : true,
      titleImage: typeof s?.titleImage === "string" ? s.titleImage : "",
      items: Array.isArray(s?.items) ? s.items : [],
      config: s?.config ?? {},
      style: s?.style ?? {},
      type: typeof s?.type === "string" ? s.type : "",
    }))
    .filter((s) => s.id && s.enabled !== false)
    .filter((s) => ALLOWED_SECTION_IDS.has(s.id));
}

function itemsToPosts(items) {
  const list = Array.isArray(items) ? items : [];
  const mapped = list
    .map((it) => ({
      link: typeof it?.link === "string" ? it.link : "",
      thumb: typeof it?.image === "string" ? it.image : "",
    }))
    .filter((p) => p.link && p.thumb);
  return mapped;
}

function ScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const id = hash.replace("#", "");
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, pathname]);

  return null;
}

function RouteLoaderEffect({ setLoadingPage, readyForRouteLoader }) {
  const location = useLocation();

  useEffect(() => {
    if (!readyForRouteLoader) return;

    setLoadingPage(true);

    const t = setTimeout(() => {
      setLoadingPage(false);
    }, 400);

    return () => clearTimeout(t);
  }, [location.pathname, setLoadingPage, readyForRouteLoader]);

  return null;
}

function GlobalFloatingButtons({ theme }) {
  const location = useLocation();
  const pathname = location.pathname || "";
  const isAdminRoute = pathname.startsWith("/admin");
  const isHomeRoute = pathname === "/";

  if (isAdminRoute) return null;

  return (
    <>
      <WhatsAppButton config={theme?.global?.whatsapp} />
      {isHomeRoute && <ScrollButton config={theme?.global?.scrollButtons} />}
    </>
  );
}

// 👉 Home como componente normal
function Home({ theme }) {
  const sections = useMemo(() => normalizeSections(theme), [theme]);

  const shouldUseDynamic =
    Array.isArray(theme?.sections) && theme.sections.length > 0;

  const instaPosts = useMemo(() => {
    if (!shouldUseDynamic) return FALLBACK_INSTA_POSTS;
    const sec = sections.find((s) => s.id === "instagram");
    const fromItems = itemsToPosts(sec?.items);
    return fromItems.length ? fromItems : FALLBACK_INSTA_POSTS;
  }, [sections, shouldUseDynamic]);

  const tiktokPosts = useMemo(() => {
    if (!shouldUseDynamic) return FALLBACK_TIKTOK_POSTS;
    const sec = sections.find((s) => s.id === "tiktok");
    const fromItems = itemsToPosts(sec?.items);
    return fromItems.length ? fromItems : FALLBACK_TIKTOK_POSTS;
  }, [sections, shouldUseDynamic]);

  const complementosImageSrc = useMemo(() => {
    if (!shouldUseDynamic) return "/SeccionComplementos/Complementos.png";
    const sec = sections.find((s) => s.id === "complementos");
    return (
      sec?.config?.imageSrc ||
      sec?.titleImage ||
      (Array.isArray(sec?.items) && sec.items[0]?.image ? sec.items[0].image : "") ||
      "/SeccionComplementos/Complementos.png"
    );
  }, [sections, shouldUseDynamic]);

  const renderSectionById = (id) => {
    switch (id) {
      case "banner":
        return <CarouselBanner />;

      case "tendencia":
        return <TrendingSection theme={theme} />;

      case "look":
        return <LookSection theme={theme} />;

      case "complementos":
        return <ComplementosLook theme={theme} imageSrc={complementosImageSrc} />;

      case "categorias":
        return <CategoriasSection theme={theme} />;

      case "instagram":
        return <InstagramSection theme={theme} posts={instaPosts} />;

      case "tiktok":
        return <TiktokSection theme={theme} posts={tiktokPosts} />;

      case "informacion":
        return <InformacionSection theme={theme} />;

      default:
        return null;
    }
  };

  const SectionWrapper = ({ id, children }) => (
    <section id={id} className="w-full">
      {children}
    </section>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <div className="flex-grow">
        <SectionWrapper id="banner">
          <CarouselBanner />
        </SectionWrapper>

        {shouldUseDynamic ? (
          <>
            {sections
              .filter((s) => s.id !== "banner")
              .map((s) => (
                <SectionWrapper key={s.id} id={s.id}>
                  {renderSectionById(s.id)}
                </SectionWrapper>
              ))}
            <SectionWrapper id="footer">
              <FooterSection theme={theme} />
            </SectionWrapper>
          </>
        ) : (
          <>
            <SectionWrapper id="tendencia">
              <TrendingSection theme={theme} />
            </SectionWrapper>

            <SectionWrapper id="look">
              <LookSection theme={theme} />
            </SectionWrapper>

            <SectionWrapper id="complementos">
              <ComplementosLook
                theme={theme}
                imageSrc="/SeccionComplementos/Complementos.png"
              />
            </SectionWrapper>

            <SectionWrapper id="categorias">
              <CategoriasSection theme={theme} />
            </SectionWrapper>

            <SectionWrapper id="instagram">
              <InstagramSection theme={theme} posts={instaPosts} />
            </SectionWrapper>

            <SectionWrapper id="tiktok">
              <TiktokSection theme={theme} posts={tiktokPosts} />
            </SectionWrapper>

            <SectionWrapper id="informacion">
              <InformacionSection theme={theme} />
            </SectionWrapper>

            <SectionWrapper id="footer">
              <FooterSection theme={theme} />
            </SectionWrapper>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [themeFromServer, setThemeFromServer] = useState(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [themeReady, setThemeReady] = useState(false);

  const reloadTheme = async () => {
    try {
      setLoadingPage(true);

      const data = await fetchSiteSettings();

      if (data?.theme) {
        const normalizedTheme = {
          ...data.theme,
          global: normalizeGlobalConfig(data.theme?.global),
        };

        setThemeFromServer(normalizedTheme);
        console.log("✅ theme.sections =", normalizedTheme?.sections);
        applyTheme(normalizedTheme);
        console.log("🎨 Tema aplicado desde /api/site-settings");
      } else {
        console.warn('⚠️ No se encontró "theme" en /api/site-settings');
      }
    } catch (error) {
      console.error("❌ Error cargando site settings:", error);
    } finally {
      setTimeout(() => {
        setLoadingPage(false);
        setThemeReady(true);
      }, 400);
    }
  };

  useEffect(() => {
    reloadTheme();
  }, []);

  useEffect(() => {
    const onEvent = () => reloadTheme();

    const onStorage = (e) => {
      if (e.key === RB_SETTINGS_TICK_KEY) reloadTheme();
    };

    window.addEventListener("rb_site_settings_updated", onEvent);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("rb_site_settings_updated", onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <AuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollToHash />
            <RouteLoaderEffect
              setLoadingPage={setLoadingPage}
              readyForRouteLoader={themeReady}
            />
            <GlobalFloatingButtons theme={themeFromServer} />

            {themeReady && (
              <GlobalPageLoader
                config={themeFromServer?.global?.loader}
                visible={loadingPage}
              />
            )}

            <Routes>
              <Route path="/" element={<Home theme={themeFromServer} />} />
              <Route
                path="/pagina/:slug"
                element={<DynamicPage theme={themeFromServer} />}
              />

              <Route path="/producto/:id" element={<ProductDetail />} />
              <Route path="/p/:id" element={<ProductDetail />} />

              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/admin/reset-password" element={<ResetPasswordPage />} />

              <Route path="/carrito" element={<Carrito />} />
              <Route path="/favoritos" element={<Favoritos />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/gracias" element={<GraciasPage />} />
              <Route path="/probe-site-settings" element={<ApiProbe />} />

              <Route
                path="/admin"
                element={
                  <PrivateRoute>
                    <AdminLayout />
                  </PrivateRoute>
                }
              >
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="productos" element={<ProductosAdmin />} />
                <Route path="productos/nuevo" element={<FormularioProducto />} />
                <Route path="productos/editar/:id" element={<FormularioProducto />} />

                <Route path="carritos" element={<CarritosAdmin />} />
                <Route path="favoritos" element={<FavoritosAdmin />} />

                <Route path="ordenes" element={<OrdersAdmin />} />
                <Route path="apariencia" element={<AppearancePage />} />

                <Route
                  path="configuracion"
                  element={<Navigate to="/admin/configuracion/empresa" replace />}
                />
                <Route path="configuracion/empresa" element={<ConfiguracionPage />} />
                <Route path="configuracion/sedes" element={<ConfiguracionPage />} />
                <Route
                  path="configuracion/facturacion"
                  element={<ConfiguracionPage />}
                />
                <Route path="configuracion/pagos" element={<ConfiguracionPage />} />
                <Route path="configuracion/envios" element={<ConfiguracionPage />} />
                <Route path="configuracion/correo" element={<ConfiguracionPage />} />
                <Route
                  path="configuracion/login-admin"
                  element={<ConfiguracionPage />}
                />
                <Route
                  path="configuracion/panel-admin"
                  element={<ConfiguracionPage />}
                />
                <Route
                  path="configuracion/usuarios"
                  element={<ConfiguracionPage />}
                />
                <Route
                  path="configuracion/perfiles"
                  element={<ConfiguracionPage />}
                />
                <Route
                  path="configuracion/logs"
                  element={<ConfiguracionPage />}
                />

                <Route path="paginas" element={<PagesAdmin />} />
                <Route path="paginas/:id" element={<PageEditor />} />
                <Route path="catalogo/:id" element={<CatalogPageEditor />} />
                <Route
                  path="product-detail/:id"
                  element={<ProductDetailPageEditor />}
                />
                <Route path="cart-page/:id" element={<CartPageEditor />} />
                <Route
                  path="checkout-page/:id"
                  element={<CheckoutPageEditor />}
                />
                <Route path="thanks-page/:id" element={<ThanksPageEditor />} />
                <Route
                  path="favorites-page/:id"
                  element={<FavoritesPageEditor />}
                />
                <Route
                  path="notfound-page/:id"
                  element={<NotFoundPageEditor />}
                />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>

            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              pauseOnHover
            />
          </BrowserRouter>
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}