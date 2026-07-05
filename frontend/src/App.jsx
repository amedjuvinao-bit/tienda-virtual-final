import 'react-toastify/dist/ReactToastify.css';
import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import ApiProbe from './admin/ApiProbe';

import { fetchSiteSettings } from './theme/siteSettingsApi';
import { applyTheme } from './theme/applyTheme';
import { normalizeGlobalConfig } from './admin/appearance/general/generalHelpers';

import Header from './components/Header';
import FooterSection from './components/FooterSection';
import ScrollButton from './components/ScrollButton';
import WhatsAppButton from './components/WhatsAppButton';
import GlobalPageLoader from './components/GlobalPageLoader';
import CarouselBanner from './components/CarouselBanner';
import TrendingSection from './components/TrendingSection';
import LookSection from './components/LookSection';
import ComplementosLook from './components/ComplementosLook';
import CategoriasSection from './components/CategoriasSection';
import InstagramSection from './components/InstagramSection';
import TiktokSection from './components/TiktokSection';
import InformacionSection from './components/InformacionSection.jsx';

import ProductDetail from './pages/ProductDetail';
import GraciasPage from './pages/GraciasPage';
import DynamicPage from './pages/DynamicPage';
import CheckoutPage from './pages/CheckoutPage';
import Carrito from './pages/Carrito';
import Favoritos from './pages/Favoritos';
import NotFound from './pages/NotFound';

import Login from './admin/Login';
import ForgotPasswordPage from './admin/ForgotPasswordPage';
import ResetPasswordPage from './admin/ResetPasswordPage';
import FormularioProducto from './admin/FormularioProducto';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/Dashboard';
import ProductosAdmin from './admin/ProductosAdmin';
import InventoryAdmin from './admin/InventoryAdmin';
import PosSalesPage from './admin/pos/PosSalesPage';
import CashSessionsPage from './admin/cash/CashSessionsPage';
import AdminCustomersPage from './admin/customers/AdminCustomersPage';
import PagesAdmin from './admin/pages/PagesAdmin';
import PageEditor from './admin/pages/PageEditor';
import CatalogPageEditor from './admin/pages/CatalogPageEditor';
import ProductDetailPageEditor from './admin/pages/ProductDetailPageEditor';
import CartPageEditor from './admin/pages/CartPageEditor';
import CheckoutPageEditor from './admin/pages/CheckoutPageEditor';
import ThanksPageEditor from './admin/pages/ThanksPageEditor';
import FavoritesPageEditor from './admin/pages/FavoritesPageEditor';
import NotFoundPageEditor from './admin/pages/NotFoundPageEditor';
import ConfiguracionPage from './admin/ConfiguracionPage';
import AdminPermissionRoute from './admin/security/AdminPermissionRoute';
import CarritosAdmin from './admin/CarritosAdmin';
import FavoritosAdmin from './admin/FavoritosAdmin';
import OrdersAdmin from './admin/OrdersAdmin';
import AppearancePage from './admin/AppearancePage';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { CartProvider } from './context/CartContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';

const RB_SETTINGS_TICK_KEY = 'rb_site_settings_tick';

function ScrollToHash() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, pathname]);

  return null;
}

function RouteLoaderEffect({ setLoadingPage, readyForRouteLoader }) {
  const location = useLocation();

  useEffect(() => {
    if (!readyForRouteLoader) return undefined;
    setLoadingPage(true);
    const t = setTimeout(() => setLoadingPage(false), 400);
    return () => clearTimeout(t);
  }, [location.pathname, setLoadingPage, readyForRouteLoader]);

  return null;
}

function GlobalFloatingButtons({ theme }) {
  const location = useLocation();
  const pathname = location.pathname || '';
  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      <WhatsAppButton config={theme?.global?.whatsapp} />
      {pathname === '/' && <ScrollButton config={theme?.global?.scrollButtons} />}
    </>
  );
}

function Home({ theme }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-grow">
        <section id="banner" className="w-full"><CarouselBanner /></section>
        <section id="tendencia" className="w-full"><TrendingSection theme={theme} /></section>
        <section id="look" className="w-full"><LookSection theme={theme} /></section>
        <section id="complementos" className="w-full"><ComplementosLook theme={theme} imageSrc="/SeccionComplementos/Complementos.png" /></section>
        <section id="categorias" className="w-full"><CategoriasSection theme={theme} /></section>
        <section id="instagram" className="w-full"><InstagramSection theme={theme} posts={[]} /></section>
        <section id="tiktok" className="w-full"><TiktokSection theme={theme} posts={[]} /></section>
        <section id="informacion" className="w-full"><InformacionSection theme={theme} /></section>
        <section id="footer" className="w-full"><FooterSection theme={theme} /></section>
      </div>
    </div>
  );
}

function protectAdminContent(element) {
  return <AdminPermissionRoute>{element}</AdminPermissionRoute>;
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
        console.log('theme.sections =', normalizedTheme?.sections);
        applyTheme(normalizedTheme);
        console.log('Tema aplicado desde /api/site-settings');
      }
    } catch (error) {
      console.error('Error cargando site settings:', error);
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
    const onStorage = (event) => {
      if (event.key === RB_SETTINGS_TICK_KEY) reloadTheme();
    };

    window.addEventListener('rb_site_settings_updated', onEvent);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('rb_site_settings_updated', onEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <AuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <BrowserRouter>
            <ScrollToHash />
            <RouteLoaderEffect setLoadingPage={setLoadingPage} readyForRouteLoader={themeReady} />
            <GlobalFloatingButtons theme={themeFromServer} />
            {themeReady && <GlobalPageLoader config={themeFromServer?.global?.loader} visible={loadingPage} />}

            <Routes>
              <Route path="/" element={<Home theme={themeFromServer} />} />
              <Route path="/pagina/:slug" element={<DynamicPage theme={themeFromServer} />} />
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
                <Route path="dashboard" element={protectAdminContent(<Dashboard />)} />
                <Route path="productos" element={protectAdminContent(<ProductosAdmin />)} />
                <Route path="ordenes" element={protectAdminContent(<OrdersAdmin />)} />
                <Route path="clientes" element={protectAdminContent(<AdminCustomersPage />)} />
                <Route path="pos" element={protectAdminContent(<PosSalesPage />)} />
                <Route path="caja" element={protectAdminContent(<CashSessionsPage />)} />
                <Route path="inventario" element={protectAdminContent(<InventoryAdmin />)} />
                <Route path="productos/nuevo" element={protectAdminContent(<FormularioProducto />)} />
                <Route path="productos/editar/:id" element={protectAdminContent(<FormularioProducto />)} />
                <Route path="carritos" element={protectAdminContent(<CarritosAdmin />)} />
                <Route path="favoritos" element={protectAdminContent(<FavoritosAdmin />)} />
                <Route path="apariencia" element={protectAdminContent(<AppearancePage />)} />
                <Route path="configuracion" element={<Navigate to="/admin/configuracion/empresa" replace />} />
                <Route path="configuracion/empresa" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/sedes" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/facturacion" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/pagos" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/envios" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/correo" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/login-admin" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/panel-admin" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/usuarios" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/perfiles" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="configuracion/logs" element={protectAdminContent(<ConfiguracionPage />)} />
                <Route path="paginas" element={protectAdminContent(<PagesAdmin />)} />
                <Route path="paginas/:id" element={protectAdminContent(<PageEditor />)} />
                <Route path="catalogo/:id" element={protectAdminContent(<CatalogPageEditor />)} />
                <Route path="product-detail/:id" element={protectAdminContent(<ProductDetailPageEditor />)} />
                <Route path="cart-page/:id" element={protectAdminContent(<CartPageEditor />)} />
                <Route path="checkout-page/:id" element={protectAdminContent(<CheckoutPageEditor />)} />
                <Route path="thanks-page/:id" element={protectAdminContent(<ThanksPageEditor />)} />
                <Route path="favorites-page/:id" element={protectAdminContent(<FavoritesPageEditor />)} />
                <Route path="notfound-page/:id" element={protectAdminContent(<NotFoundPageEditor />)} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>

            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="colored"
            />
          </BrowserRouter>
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
