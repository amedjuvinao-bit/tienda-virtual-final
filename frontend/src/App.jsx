import 'react-toastify/dist/ReactToastify.css';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';

import { fetchSiteSettings } from './theme/siteSettingsApi';
import { applyTheme } from './theme/applyTheme';
import { normalizeGlobalConfig } from './admin/appearance/general/generalHelpers';
import GlobalPageLoader from './components/GlobalPageLoader';
import AppToastContainer from './components/AppToastContainer';
import { AppConfirmProvider } from './components/AppConfirmProvider';
import AdminPermissionRoute from './admin/security/AdminPermissionRoute';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { CartProvider } from './context/CartContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';

const ApiProbe = lazy(() => import('./admin/ApiProbe'));
const Header = lazy(() => import('./components/Header'));
const FooterSection = lazy(() => import('./components/FooterSection'));
const ScrollButton = lazy(() => import('./components/ScrollButton'));
const WhatsAppButton = lazy(() => import('./components/WhatsAppButton'));
const CarouselBanner = lazy(() => import('./components/CarouselBanner'));
const TrendingSection = lazy(() => import('./components/TrendingSection'));
const LookSection = lazy(() => import('./components/LookSection'));
const ComplementosLook = lazy(() => import('./components/ComplementosLook'));
const CategoriasSection = lazy(() => import('./components/CategoriasSection'));
const InstagramSection = lazy(() => import('./components/InstagramSection'));
const TiktokSection = lazy(() => import('./components/TiktokSection'));
const InformacionSection = lazy(() => import('./components/InformacionSection.jsx'));

const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const GraciasPage = lazy(() => import('./pages/GraciasPage'));
const OrderReturnsPage = lazy(() => import('./pages/OrderReturnsPage'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const Carrito = lazy(() => import('./pages/Carrito'));
const Favoritos = lazy(() => import('./pages/Favoritos'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Login = lazy(() => import('./admin/Login'));
const ForgotPasswordPage = lazy(() => import('./admin/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./admin/ResetPasswordPage'));
const FormularioProducto = lazy(() => import('./admin/FormularioProducto'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const ProductosAdmin = lazy(() => import('./admin/ProductosAdmin'));
const InventoryAdmin = lazy(() => import('./admin/InventoryAdmin'));
const PosSalesPage = lazy(() => import('./admin/pos/PosSalesPage'));
const CashSessionsPage = lazy(() => import('./admin/cash/CashSessionsPage'));
const AdminFinancePage = lazy(() => import('./admin/finance/AdminFinancePage'));
const AdminCouponsPage = lazy(() => import('./admin/coupons/AdminCouponsPage'));
const AdminBillingPage = lazy(() => import('./admin/billing/AdminBillingPage'));
const AdminCustomersPage = lazy(() => import('./admin/customers/AdminCustomersPage'));
const PagesAdmin = lazy(() => import('./admin/pages/PagesAdmin'));
const PageEditor = lazy(() => import('./admin/pages/PageEditor'));
const CatalogPageEditor = lazy(() => import('./admin/pages/CatalogPageEditor'));
const ProductDetailPageEditor = lazy(() => import('./admin/pages/ProductDetailPageEditor'));
const CartPageEditor = lazy(() => import('./admin/pages/CartPageEditor'));
const CheckoutPageEditor = lazy(() => import('./admin/pages/CheckoutPageEditor'));
const ThanksPageEditor = lazy(() => import('./admin/pages/ThanksPageEditor'));
const FavoritesPageEditor = lazy(() => import('./admin/pages/FavoritesPageEditor'));
const NotFoundPageEditor = lazy(() => import('./admin/pages/NotFoundPageEditor'));
const ConfiguracionPage = lazy(() => import('./admin/ConfiguracionPage'));
const CarritosAdmin = lazy(() => import('./admin/CarritosAdmin'));
const FavoritosAdmin = lazy(() => import('./admin/FavoritosAdmin'));
const OrdersAdmin = lazy(() => import('./admin/OrdersAdmin'));
const AppearancePage = lazy(() => import('./admin/AppearancePage'));

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
            <AppConfirmProvider>
              <Suspense fallback={null}>
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
                  <Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} />
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
                    <Route path="facturacion" element={<Navigate to="/admin/facturacion/resumen" replace />} />
                    <Route path="facturacion/:tab" element={protectAdminContent(<AdminBillingPage />)} />
                    <Route path="clientes" element={protectAdminContent(<AdminCustomersPage />)} />
                    <Route path="pos" element={protectAdminContent(<PosSalesPage />)} />
                    <Route path="caja" element={protectAdminContent(<CashSessionsPage />)} />
                    <Route path="finanzas" element={protectAdminContent(<AdminFinancePage />)} />
                    <Route path="cupones" element={protectAdminContent(<AdminCouponsPage />)} />
                    <Route path="inventario" element={protectAdminContent(<InventoryAdmin />)} />
                    <Route path="productos/nuevo" element={protectAdminContent(<FormularioProducto />)} />
                    <Route path="productos/editar/:id" element={protectAdminContent(<FormularioProducto />)} />
                    <Route path="carritos" element={protectAdminContent(<CarritosAdmin />)} />
                    <Route path="favoritos" element={protectAdminContent(<FavoritosAdmin />)} />
                    <Route path="apariencia" element={protectAdminContent(<AppearancePage />)} />
                    <Route path="configuracion" element={<Navigate to="/admin/configuracion/empresa" replace />} />
                    <Route path="configuracion/empresa" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/sedes" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/facturacion" element={<Navigate to="/admin/facturacion/configuracion" replace />} />
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

                <AppToastContainer />
              </Suspense>
            </AppConfirmProvider>
          </BrowserRouter>
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
