import 'react-toastify/dist/ReactToastify.css';
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import StorefrontLoadingScreen, { StorefrontLoadingBoundary } from './components/StorefrontLoadingScreen';
import { rememberStorefrontLoadingAppearance } from './theme/storefrontLoadingAppearance';
import RouteLoaderEffect from './components/RouteLoaderEffect';
import AppToastContainer from './components/AppToastContainer';
import BackupMaintenanceNotice from './components/BackupMaintenanceNotice';
import { AppConfirmProvider } from './components/AppConfirmProvider';
import AdminPermissionRoute from './admin/security/AdminPermissionRoute';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { CartProvider } from './context/CartContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';
import { loadCashSessionsPage, loadOrdersAdmin, loadPosSalesPage, loadProductsAdmin } from './admin/adminRoutePreload';
import AdminLoadingScreen from './admin/loading/AdminLoadingScreen';
import { AdminLogoutGate } from './admin/loading/AdminLogoutPending';
import { getRememberedAdminLoader, normalizeAdminLoader, rememberAdminLoader, rememberAdminLoadingColors } from './admin/loading/adminLoaderConfig';
import { storySectionOrder } from './lib/storefrontStoryConfig';
import StorefrontStory from './components/StorefrontStory';
import StorefrontActionFeedback from './components/StorefrontActionFeedback';
import StorefrontScrollRestoration from './components/StorefrontScrollRestoration';
import { StorefrontSettingsContext } from './context/StorefrontSettingsContext';
import { isStorefrontSectionVisible } from './lib/storefrontSectionVisibility';
import './storefrontSectionMotion.css';

const ReturnsPageEditor = lazy(() => import('./admin/pages/ReturnsPageEditor'));
const SearchPageEditor = lazy(() => import('./admin/pages/SearchPageEditor'));
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
const SearchResults = lazy(() => import('./pages/SearchResults'));
const NotFound = lazy(() => import('./pages/NotFound'));

const Login = lazy(() => import('./admin/Login'));
const ForgotPasswordPage = lazy(() => import('./admin/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./admin/ResetPasswordPage'));
const FormularioProducto = lazy(() => import('./admin/FormularioProducto'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const Dashboard = lazy(() => import('./admin/Dashboard'));
const ProductosAdmin = lazy(loadProductsAdmin);
const InventoryAdmin = lazy(() => import('./admin/InventoryAdmin'));
const PosSalesPage = lazy(loadPosSalesPage);
const CashSessionsPage = lazy(loadCashSessionsPage);
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
const OrdersAdmin = lazy(loadOrdersAdmin);
const AppearancePage = lazy(() => import('./admin/AppearancePage'));

const RB_SETTINGS_TICK_KEY = 'rb_site_settings_tick';

function AdminDocumentRoute() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      document.documentElement.dataset.adminEntry = 'true';
      document.documentElement.dataset.adminContext = pathname.startsWith('/admin/login') ? 'login' : 'admin';
    } else {
      delete document.documentElement.dataset.adminEntry;
      delete document.documentElement.dataset.adminContext;
    }
  }, [pathname]);

  return null;
}

function GlobalFloatingButtons({ theme }) {
  const location = useLocation();
  const pathname = location.pathname || '';
  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      <WhatsAppButton config={theme?.global?.whatsapp} />
      {pathname === '/' && <ScrollButton config={theme?.global?.scrollButtons} motionConfig={theme?.global?.sectionMotion} buttonAnimation={theme?.banner?.templateConfigs?.[theme?.banner?.templateId]?.buttonAnimation} />}
    </>
  );
}

function Home({ theme, store }) {
  const components={tendencia:TrendingSection,look:LookSection,complementos:ComplementosLook,categorias:CategoriasSection,instagram:InstagramSection,tiktok:TiktokSection,informacion:InformacionSection};

  return (
    <div className="flex min-h-screen w-full min-w-0 max-w-full flex-col">
      <Header />
      <StorefrontStory config={theme?.global?.sectionMotion}>
        <section id="banner" className="w-full"><CarouselBanner /></section>
        {storySectionOrder(theme?.sections).filter(id=>isStorefrontSectionVisible(theme,id)).map(id=>{
          const Component=components[id];
          return <section key={id} id={id} className="storefront-section-shell w-full"><Component theme={theme} {...(id==='complementos'?{imageSrc:'/SeccionComplementos/Complementos.png'}:{})} {...(['instagram','tiktok'].includes(id)?{posts:[]}:{})}/></section>;
        })}
        <section id="footer" className="w-full"><FooterSection theme={theme} store={store} /></section>
      </StorefrontStory>
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
  const [adminConnectionError, setAdminConnectionError] = useState(false);
  const adminConnectionErrorLogged = useRef(false);
  const [adminLoader, setAdminLoader] = useState(getRememberedAdminLoader);
  const [siteSettingsFromServer, setSiteSettingsFromServer] = useState(null);

  const settingsRequest = useRef(0);
  const reloadTheme = async ({ silent = false } = {}) => {
    const requestId = ++settingsRequest.current;
    let succeeded = false;
    try {
      if (!silent && !window.location.pathname.startsWith('/admin')) setLoadingPage(true);
      const data = await fetchSiteSettings();
      if (requestId !== settingsRequest.current) return false;
      const nextLoader = normalizeAdminLoader(data?.admin?.loader);
      setAdminLoader(nextLoader);
      rememberAdminLoader(nextLoader);
      rememberAdminLoadingColors(data);
      setSiteSettingsFromServer(data);

      if (data?.theme) {
        const normalizedTheme = {
          ...data.theme,
          global: normalizeGlobalConfig(data.theme?.global),
        };
        setThemeFromServer(normalizedTheme);
        applyTheme(normalizedTheme);
        rememberStorefrontLoadingAppearance(normalizedTheme);
      }
      succeeded = true;
      adminConnectionErrorLogged.current = false;
      setAdminConnectionError(false);
    } catch (error) {
      if (requestId !== settingsRequest.current) return false;
      if (!adminConnectionErrorLogged.current) console.error('Error cargando site settings:', error);
      adminConnectionErrorLogged.current = true;
      if (window.location.pathname.startsWith('/admin')) setAdminConnectionError(true);
    } finally {
      const finish = () => {
        if (requestId !== settingsRequest.current) return;
        setLoadingPage(false);
        if (succeeded || !window.location.pathname.startsWith('/admin')) setThemeReady(true);
      };
      finish();
    }
    return succeeded;
  };

  useEffect(() => {
    const onLoaderUpdated = (event) => setAdminLoader(normalizeAdminLoader(event.detail));
    const onLoginSettingsUpdated = (event) => rememberAdminLoadingColors({ loginAdmin: event.detail });
    window.addEventListener('admin-loader-updated', onLoaderUpdated);
    window.addEventListener('admin-login-settings-updated', onLoginSettingsUpdated);
    return () => {
      window.removeEventListener('admin-loader-updated', onLoaderUpdated);
      window.removeEventListener('admin-login-settings-updated', onLoginSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let retryTimer;
    const loadInitialSettings = async () => {
      const ready = await reloadTheme();
      if (active && !ready && window.location.pathname.startsWith('/admin')) {
        retryTimer = window.setTimeout(loadInitialSettings, 2000);
      }
    };
    loadInitialSettings();
    return () => {
      active = false;
      window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    const onEvent = () => reloadTheme();
    const onFocus = () => reloadTheme({ silent: true });
    const onStorage = (event) => {
      if (event.key === RB_SETTINGS_TICK_KEY) reloadTheme();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('rb_site_settings_updated', onEvent);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('rb_site_settings_updated', onEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return (
    <AuthProvider>
      <FavoritesProvider>
        <CartProvider>
          <StorefrontSettingsContext.Provider value={siteSettingsFromServer}>
          <BrowserRouter>
            <AdminDocumentRoute />
            <StorefrontScrollRestoration ready={themeReady} />
            <StorefrontActionFeedback />
            <BackupMaintenanceNotice adminPanelReady={themeReady} />
            <AppConfirmProvider>
              <StorefrontLoadingBoundary config={themeFromServer?.global?.loader} loading={!themeReady || loadingPage}>
              <Suspense fallback={window.location.pathname.startsWith('/admin') ? <AdminLoadingScreen context={window.location.pathname.startsWith('/admin/login') ? 'login' : 'admin'} model={adminLoader} /> : <StorefrontLoadingScreen />}>
                <RouteLoaderEffect setLoadingPage={setLoadingPage} readyForRouteLoader={themeReady} />
                {themeReady && <GlobalFloatingButtons theme={themeFromServer} />}

                <AdminLogoutGate>
                {!themeReady ? window.location.pathname.startsWith('/admin') ? <AdminLoadingScreen context={window.location.pathname.startsWith('/admin/login') ? 'login' : 'admin'} model={adminLoader} message={adminConnectionError ? 'Esperando configuración del servidor…' : 'Preparando tu panel…'} /> : <StorefrontLoadingScreen /> : <Routes>
                  <Route path="/" element={<Home theme={themeFromServer} store={siteSettingsFromServer?.store} />} />
                  <Route path="/pagina/:slug" element={<DynamicPage theme={themeFromServer} />} />
                  <Route path="/lo-nuevo" element={<Navigate to="/#tendencia" replace />} />
                  <Route path="/producto/:id" element={<ProductDetail />} />
                  <Route path="/p/:id" element={<ProductDetail />} />
                  <Route path="/admin/login" element={<Login initialSettings={siteSettingsFromServer} loaderModel={adminLoader} />} />
                  <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/carrito" element={<Carrito />} />
                  <Route path="/favoritos" element={<Favoritos />} />
                  <Route path="/buscar" element={<SearchResults theme={themeFromServer} />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/gracias" element={<GraciasPage />} />
                  <Route path="/devoluciones/:orderId" element={<OrderReturnsPage />} />
                  {import.meta.env.DEV && <Route path="/probe-site-settings" element={<ApiProbe />} />}

                  <Route
                    path="/admin"
                    element={
                      <PrivateRoute loaderModel={adminLoader}>
                        <AdminLayout initialSettings={siteSettingsFromServer} />
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
                    <Route path="configuracion/instagram" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/tiktok" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/correo" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/login-admin" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/panel-admin" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/usuarios" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/perfiles" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/seguridad" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/respaldos" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="configuracion/logs" element={protectAdminContent(<ConfiguracionPage />)} />
                    <Route path="paginas" element={protectAdminContent(<PagesAdmin />)} />
                    <Route path="paginas/:id" element={protectAdminContent(<PageEditor />)} />
                    <Route path="catalogo/:id" element={protectAdminContent(<CatalogPageEditor />)} />
                    <Route path="product-detail/:id" element={protectAdminContent(<ProductDetailPageEditor />)} />
                    <Route path="cart-page/:id" element={protectAdminContent(<CartPageEditor />)} />
                    <Route path="checkout-page/:id" element={protectAdminContent(<CheckoutPageEditor />)} />
                    <Route path="thanks-page/:id" element={protectAdminContent(<ThanksPageEditor />)} />
                    <Route path="favorites-page/:id" element={protectAdminContent(<FavoritesPageEditor />)} />
                    <Route path="returns-page/:id" element={protectAdminContent(<ReturnsPageEditor />)} />
                    <Route path="search-page/:id" element={protectAdminContent(<SearchPageEditor />)} />
                    <Route path="notfound-page/:id" element={protectAdminContent(<NotFoundPageEditor />)} />
                  </Route>

                  <Route path="*" element={<NotFound />} />
                </Routes>}
                </AdminLogoutGate>

                <AppToastContainer />
              </Suspense>
              </StorefrontLoadingBoundary>
            </AppConfirmProvider>
          </BrowserRouter>
          </StorefrontSettingsContext.Provider>
        </CartProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
