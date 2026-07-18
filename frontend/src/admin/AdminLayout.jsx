// src/admin/AdminLayout.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Outlet,
  useNavigate,
  NavLink,
  useLocation,
} from 'react-router-dom';
import {
  Bell,
  Star,
  Trash2,
  X,
  ChevronDown,
  LayoutDashboard,
  Package,
  PackageSearch,
  ShoppingCart,
  Heart,
  ClipboardList,
  Palette,
  Settings,
  FileText,
  LogOut,
  Search,
  Store,
  Building2,
  ReceiptText,
  CreditCard,
  Truck,
  Mail,
  ShieldCheck,
  Users,
  UserCog,
  UserRound,
  ScrollText,
  WalletCards,
  CircleDollarSign,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { setAdminToken } from '../lib/api';
import { applyAdminTheme } from './theme/adminTheme';
import { applyAdminLayoutStyles } from './theme/adminLayoutStyles';
import { applyAdminGlobalStyles } from './theme/adminGlobalStyles';
import { canAccessAdminPath } from './security/adminPermissions';

const ADMIN_REVIEW_SEEN_KEY = 'admin_seen_review_ids';

const CONFIG_SUBLINKS = [
  { to: '/admin/configuracion/empresa', label: 'Tienda', icon: Store },
  { to: '/admin/configuracion/facturacion', label: 'Facturación', icon: ReceiptText },
  { to: '/admin/configuracion/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/admin/configuracion/envios', label: 'Envíos', icon: Truck },
  { to: '/admin/configuracion/correo', label: 'Correo', icon: Mail },
  { to: '/admin/configuracion/login-admin', label: 'Login admin', icon: ShieldCheck },
  { to: '/admin/configuracion/panel-admin', label: 'Panel admin', icon: Settings },
  { to: '/admin/configuracion/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/configuracion/perfiles', label: 'Perfiles', icon: UserCog },
  { to: '/admin/configuracion/sedes', label: 'Sedes', icon: Building2 },
  { to: '/admin/configuracion/logs', label: 'Logs', icon: ScrollText },
];

const MAIN_LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/ordenes', label: 'Órdenes', icon: ClipboardList },
  { to: '/admin/clientes', label: 'Clientes', icon: UserRound },
  { to: '/admin/pos', label: 'POS / Ventas físicas', icon: Store },
  { to: '/admin/caja', label: 'Caja', icon: WalletCards },
  { to: '/admin/finanzas', label: 'Finanzas', icon: CircleDollarSign },
  { to: '/admin/inventario', label: 'Inventario', icon: PackageSearch },
  { to: '/admin/carritos', label: 'Carritos', icon: ShoppingCart },
  { to: '/admin/favoritos', label: 'Favoritos', icon: Heart },
];

const DESIGN_LINKS = [
  { to: '/admin/apariencia', label: 'Apariencia', icon: Palette },
  { to: '/admin/paginas', label: 'Páginas', icon: FileText },
];

function filterLinksByPermission(adminUser, links) {
  return links.filter((item) => canAccessAdminPath(adminUser, item.to));
}

function getFirstAllowedConfigPath(adminUser) {
  const firstAllowedConfigLink = filterLinksByPermission(adminUser, CONFIG_SUBLINKS)[0];
  return firstAllowedConfigLink?.to || '/admin/dashboard';
}

function getSeenReviewIds() {
  try {
    const raw = localStorage.getItem(ADMIN_REVIEW_SEEN_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveSeenReviewIds(ids) {
  try {
    localStorage.setItem(ADMIN_REVIEW_SEEN_KEY, JSON.stringify(ids));
  } catch {
    // No bloquea el panel si el navegador no permite storage.
  }
}

function NavItem({ item, className = '' }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-[calc(var(--admin-radius)*0.55)] px-4 py-3 text-sm font-bold transition-all duration-200 ${className} ${
          isActive ? 'admin-nav-link-active' : 'admin-nav-link'
        }`
      }
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl admin-nav-icon-box">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="px-1 text-[11px] font-black uppercase tracking-[0.24em] admin-sidebar-title">
      {children}
    </p>
  );
}

function ReviewsModal({ open, onClose, reviews, loading, error, deletingReviewId, onDelete }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-[calc(var(--admin-radius)*0.9)] border shadow-2xl admin-modal-card">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 admin-modal-header">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
              Reseñas
            </p>
            <h2 className="text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>
              Opiniones de clientes
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted)' }}>
              Revisa y elimina reseñas registradas en productos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border transition hover:-translate-y-0.5"
            style={{
              borderColor: 'var(--admin-card-border)',
              color: 'var(--admin-card-text)',
              background: 'var(--admin-card-bg)',
            }}
            aria-label="Cerrar reseñas"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto p-5">
          {loading ? (
            <div className="rounded-2xl border p-5 text-sm font-bold" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted)' }}>
              Cargando reseñas…
            </div>
          ) : error ? (
            <div className="rounded-2xl border p-5 text-sm font-bold text-red-600" style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
              {error}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border p-5 text-sm font-bold" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted)' }}>
              No hay reseñas registradas.
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const reviewId = String(review?.reviewId || review?._id || '');
                const productId = String(review?.productId || review?.product?._id || '');

                return (
                  <article
                    key={`${productId}-${reviewId}`}
                    className="rounded-2xl border p-4"
                    style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                          <Star className="h-4 w-4" style={{ color: 'var(--admin-primary)' }} />
                          {review?.rating || review?.stars || 0}/5 · {review?.customerName || review?.name || 'Cliente'}
                        </div>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted)' }}>
                          {review?.productTitle || review?.productName || 'Producto'}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--admin-card-text)' }}>
                          {review?.comment || review?.text || 'Sin comentario'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDelete(productId, reviewId)}
                        disabled={!productId || !reviewId || deletingReviewId === reviewId}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition hover:-translate-y-0.5 disabled:opacity-60"
                        style={{ background: 'rgba(244, 63, 94, 0.16)', color: '#f43f5e' }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletingReviewId === reviewId ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { logout, adminUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const activeAdminName =
    adminUser?.displayName ||
    adminUser?.fullName ||
    adminUser?.username ||
    'Usuario admin';

  const activeAdminRole =
    adminUser?.adminRole ||
    adminUser?.actualRole ||
    adminUser?.role ||
    'admin';

  const activeAdminInitials =
    activeAdminName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'UA';

  const isConfigRoute = location.pathname.startsWith('/admin/configuracion');
  const [configMenuOpen, setConfigMenuOpen] = useState(isConfigRoute);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [deletingReviewId, setDeletingReviewId] = useState('');
  const [adminBrandLogo, setAdminBrandLogo] = useState('');

  const visibleMainLinks = useMemo(() => filterLinksByPermission(adminUser, MAIN_LINKS), [adminUser]);
  const visibleDesignLinks = useMemo(() => filterLinksByPermission(adminUser, DESIGN_LINKS), [adminUser]);
  const visibleConfigSublinks = useMemo(() => filterLinksByPermission(adminUser, CONFIG_SUBLINKS), [adminUser]);
  const hasVisibleConfigLinks = visibleConfigSublinks.length > 0;

  useEffect(() => {
    let alive = true;

    async function loadAdminAppearanceFromApi() {
      try {
        const res = await api.get('/api/site-settings');
        const theme = res?.data?.admin?.theme || {};
        const headerLogo =
          res?.data?.theme?.header?.logoLight ||
          res?.data?.theme?.header?.logoDark ||
          res?.data?.theme?.logo ||
          '';

        if (!alive) return;
        applyAdminTheme(theme);
        applyAdminLayoutStyles(theme);
        applyAdminGlobalStyles();
        setAdminBrandLogo(headerLogo);
      } catch (error) {
        console.error('❌ Error al cargar apariencia del panel admin:', error);
        if (!alive) return;
        applyAdminTheme({});
        applyAdminLayoutStyles({});
        applyAdminGlobalStyles();
        setAdminBrandLogo('');
      }
    }

    loadAdminAppearanceFromApi();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (isConfigRoute) setConfigMenuOpen(true);
  }, [isConfigRoute]);

  const fetchAdminReviews = async () => {
    try {
      setReviewsLoading(true);
      setReviewsError('');
      const res = await api.get('/api/products/admin/reviews');
      const rows = Array.isArray(res?.data?.reviews) ? res.data.reviews : [];
      setReviews(rows);
    } catch (error) {
      console.error('❌ Error al cargar reseñas admin:', error);
      setReviewsError(error?.response?.data?.message || error?.userMessage || 'No se pudieron cargar las reseñas');
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminReviews();
    const interval = setInterval(fetchAdminReviews, 30000);
    return () => clearInterval(interval);
  }, []);

  const unseenCount = useMemo(() => {
    const seen = new Set(getSeenReviewIds());
    return reviews.filter((review) => !seen.has(String(review.reviewId || ''))).length;
  }, [reviews]);

  const handleOpenReviewsModal = async () => {
    setReviewsModalOpen(true);
    await fetchAdminReviews();
    const ids = reviews.map((review) => String(review?.reviewId || '').trim()).filter(Boolean);
    if (ids.length) saveSeenReviewIds(ids);
  };

  useEffect(() => {
    if (!reviewsModalOpen) return;
    const ids = reviews.map((review) => String(review?.reviewId || '').trim()).filter(Boolean);
    if (ids.length) saveSeenReviewIds(ids);
  }, [reviewsModalOpen, reviews]);

  const handleDeleteReview = async (productId, reviewId) => {
    if (!productId || !reviewId) return;
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta reseña? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
      setDeletingReviewId(String(reviewId));
      setReviewsError('');
      await api.delete(`/api/products/${productId}/reviews/${reviewId}`);
      setReviews((prev) =>
        prev.filter((review) => !(String(review?.productId || '') === String(productId) && String(review?.reviewId || '') === String(reviewId)))
      );
      saveSeenReviewIds(getSeenReviewIds().filter((id) => String(id) !== String(reviewId)));
    } catch (error) {
      console.error('❌ Error al eliminar reseña:', error);
      setReviewsError(error?.response?.data?.message || error?.userMessage || 'No se pudo eliminar la reseña');
    } finally {
      setDeletingReviewId('');
    }
  };

  const handleLogout = () => {
    logout();
    setAdminToken(null);
    navigate('/admin/login');
  };

  const handleConfigMenuClick = () => {
    setConfigMenuOpen((prev) => !prev);
    if (!isConfigRoute) navigate(getFirstAllowedConfigPath(adminUser));
  };

  return (
    <>
      <style>{`
        .admin-area {
          font-family: 'DM Sans', 'Outfit', system-ui, sans-serif;
          background: var(--admin-page-bg);
          color: var(--admin-card-text);
        }

        .admin-sidebar-panel,
        .admin-header-panel,
        .admin-content-card,
        .admin-modal-card {
          background: var(--admin-card-bg);
          border: 1px solid var(--admin-card-border);
          box-shadow: var(--admin-shadow-card, 0 18px 45px rgba(15, 23, 42, 0.10));
          backdrop-filter: blur(var(--admin-blur, 16px));
          -webkit-backdrop-filter: blur(var(--admin-blur, 16px));
        }

        .admin-sidebar-panel {
          width: 220px;
          min-width: 220px;
          border-radius: var(--admin-radius);
        }

        .admin-header-panel,
        .admin-content-card {
          border-radius: calc(var(--admin-radius) * 0.9);
        }

        .admin-sidebar-title {
          color: var(--admin-card-muted);
        }

        .admin-nav-link {
          color: var(--admin-primary-soft-text);
        }

        .admin-nav-link:hover {
          background: var(--admin-nav-hover-bg, color-mix(in srgb, var(--admin-primary) 12%, transparent));
          color: var(--admin-card-text);
          transform: translateY(-1px);
        }

        .admin-nav-link-active {
          background: var(--admin-active-nav-bg);
          color: var(--admin-active-nav-text);
          box-shadow: var(--admin-shadow-active, 0 8px 24px rgba(0,0,0,0.12));
          transform: translateY(-1px);
        }

        .admin-nav-icon-box {
          background: color-mix(in srgb, var(--admin-primary) 12%, transparent);
          color: currentColor;
        }

        .admin-logo-floating {
          isolation: isolate;
        }

        .admin-logo-floating::before {
          content: '';
          position: absolute;
          inset: 8px;
          z-index: -1;
          border-radius: 999px;
          background: radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 26%, transparent), transparent 70%);
          filter: blur(18px);
        }

        .admin-search-input {
          background: var(--admin-input-bg, var(--admin-card-bg));
          border: 1px solid var(--admin-card-border);
          color: var(--admin-card-text);
        }

        .admin-search-input::placeholder {
          color: var(--admin-card-muted);
        }

        .admin-primary-button {
          background: var(--admin-primary);
          color: var(--admin-primary-contrast, #fff);
          box-shadow: 0 14px 28px color-mix(in srgb, var(--admin-primary) 24%, transparent);
        }

        .admin-soft-button {
          background: var(--admin-soft-button-bg, color-mix(in srgb, var(--admin-primary) 12%, transparent));
          color: var(--admin-card-text);
          border: 1px solid var(--admin-card-border);
        }

        @media (max-width: 900px) {
          .admin-desktop-sidebar {
            display: none;
          }
        }
      `}</style>

      <div className="admin-area min-h-screen p-3 md:p-5">
        <div className="flex gap-3 md:gap-4">
          <aside className="admin-desktop-sidebar admin-sidebar-panel sticky top-5 h-[calc(100vh-2.5rem)] overflow-y-auto p-4">
            <div className="relative mb-6 grid place-items-center admin-logo-floating">
              {adminBrandLogo ? (
                <img src={adminBrandLogo} alt="Logo tienda" className="max-h-36 max-w-[170px] object-contain" />
              ) : (
                <div className="grid h-28 w-28 place-items-center rounded-full border text-3xl font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>
                  RB
                </div>
              )}
            </div>

            <nav className="space-y-6">
              <div className="space-y-2">
                <SectionTitle>Principal</SectionTitle>
                <div className="space-y-2">
                  {visibleMainLinks.map((item) => <NavItem key={item.to} item={item} />)}
                </div>
              </div>

              {visibleDesignLinks.length ? (
                <div className="space-y-2">
                  <SectionTitle>Diseño</SectionTitle>
                  <div className="space-y-2">
                    {visibleDesignLinks.map((item) => <NavItem key={item.to} item={item} />)}
                  </div>
                </div>
              ) : null}

              {hasVisibleConfigLinks ? (
                <div className="space-y-2">
                  <SectionTitle>Sistema</SectionTitle>
                  <button
                    type="button"
                    onClick={handleConfigMenuClick}
                    className={`flex w-full items-center gap-3 rounded-[calc(var(--admin-radius)*0.55)] px-4 py-3 text-left text-sm font-bold transition-all ${isConfigRoute ? 'admin-nav-link-active' : 'admin-nav-link'}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl admin-nav-icon-box">
                      <Settings className="h-4 w-4" />
                    </span>
                    <span className="flex-1">Configuración</span>
                    <ChevronDown className={`h-4 w-4 transition ${configMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {configMenuOpen ? (
                    <div className="ml-3 space-y-1 border-l pl-3" style={{ borderColor: 'var(--admin-card-border)' }}>
                      {visibleConfigSublinks.map((item) => <NavItem key={item.to} item={item} className="py-2 text-[13px]" />)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 space-y-3 md:space-y-4">
            <header className="admin-header-panel flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
              <div>
                <h1 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Panel Administrativo</h1>
                <p className="text-sm" style={{ color: 'var(--admin-card-muted)' }}>Gestiona tu tienda en tiempo real</p>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3 md:max-w-4xl md:flex-row md:items-center md:justify-end">
                <div className="relative min-w-[220px] flex-1 md:max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--admin-card-muted)' }} />
                  <input
                    type="search"
                    placeholder="Buscar productos, órdenes, páginas..."
                    className="admin-search-input h-11 w-full rounded-2xl pl-10 pr-4 text-sm font-medium outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden min-w-[210px] items-center gap-3 rounded-2xl border px-3 py-2 md:flex" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                    <div className="grid h-10 w-10 place-items-center rounded-full border text-sm font-black" style={{ borderColor: 'var(--admin-primary)', color: 'var(--admin-primary)' }}>
                      {activeAdminInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{activeAdminName}</p>
                      <p className="truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted)' }}>Perfil: {activeAdminRole}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenReviewsModal}
                    className="admin-soft-button relative inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition hover:-translate-y-0.5"
                  >
                    <Bell className="h-4 w-4" />
                    Reseñas
                    {unseenCount > 0 ? (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black" style={{ background: 'var(--admin-primary)', color: 'var(--admin-primary-contrast, #fff)' }}>
                        {unseenCount}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="admin-soft-button inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition hover:-translate-y-0.5"
                  >
                    <LogOut className="h-4 w-4" />
                    Salir
                  </button>
                </div>
              </div>
            </header>

            <div className="md:hidden admin-header-panel overflow-x-auto p-2">
              <div className="flex min-w-max gap-2">
                {[...visibleMainLinks, ...visibleDesignLinks].map((item) => <NavItem key={item.to} item={item} className="min-w-fit" />)}
              </div>
            </div>

            <section className="admin-content-card min-h-[calc(100vh-7.5rem)] overflow-hidden">
              <Outlet />
            </section>
          </main>
        </div>
      </div>

      <ReviewsModal
        open={reviewsModalOpen}
        onClose={() => setReviewsModalOpen(false)}
        reviews={reviews}
        loading={reviewsLoading}
        error={reviewsError}
        deletingReviewId={deletingReviewId}
        onDelete={handleDeleteReview}
      />
    </>
  );
}
