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
  Sparkles,
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

function applyHoverColor(e, color) {
  e.currentTarget.style.backgroundColor = color;
}

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
    // ignore
  }
}

function ReviewsModal({
  open,
  onClose,
  reviews,
  loading,
  error,
  deletingReviewId,
  onDelete,
}) {
  if (!open) return null;

  return (
    <div className="admin-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="admin-card-glass admin-modal-card w-full max-w-5xl max-h-[88vh] overflow-hidden"
        style={{ boxShadow: 'var(--admin-shadow-modal, 0 32px 80px rgba(0,0,0,0.18))' }}
      >
        <div
          className="admin-modal-header flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--admin-card-border)' }}
        >
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--admin-card-text)' }}>
              Reseñas de productos
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--admin-card-muted-text)' }}>
              Revisa y modera las reseñas del catálogo
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'calc(var(--admin-radius) * 0.55)',
              border: '1px solid var(--admin-card-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-card-muted-text)',
              cursor: 'pointer',
              transition: 'all 0.18s',
              flexShrink: 0,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="admin-modal-body">
          {error ? (
            <div className="admin-modal-error border border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              Cargando reseñas...
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              No hay reseñas registradas todavía.
            </div>
          ) : (
            <div className="admin-review-list max-h-[62vh] overflow-y-auto admin-thin-scrollbar pr-1 flex flex-col">
              {reviews.map((review, index) => {
                const date = review?.createdAt ? new Date(review.createdAt) : null;
                const reviewId = String(review?.reviewId || review?._id || index);
                const productId = String(review?.productId || review?.product?._id || '');

                return (
                  <div
                    key={`${productId}-${reviewId}`}
                    className="admin-review-card border transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--admin-primary-soft-bg)',
                      borderColor: 'var(--admin-primary-soft-border)',
                    }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between" style={{ gap: 'var(--admin-gap)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start admin-inline-gap-md">
                          {review?.productImage ? (
                            <img
                              src={review.productImage}
                              alt={review.productTitle || 'Producto'}
                              className="admin-small-image-radius w-14 h-14 object-cover border bg-white shrink-0"
                              style={{ borderColor: 'var(--admin-card-border)' }}
                            />
                          ) : (
                            <div
                              className="admin-small-image-radius w-14 h-14 border bg-white flex items-center justify-center text-xs shrink-0"
                              style={{
                                borderColor: 'var(--admin-card-border)',
                                color: 'var(--admin-card-muted-text)',
                              }}
                            >
                              Sin foto
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--admin-primary)' }}>
                              Producto
                            </p>
                            <h3 className="font-semibold text-sm break-words leading-snug" style={{ color: 'var(--admin-card-text)' }}>
                              {review?.productTitle || review?.productName || 'Sin título'}
                            </h3>
                            <div className="mt-1.5 flex items-center admin-inline-gap-xs">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Star
                                  key={value}
                                  className="w-3.5 h-3.5"
                                  style={{
                                    color: value <= Number(review?.rating || review?.stars || 0) ? '#d4af37' : '#d1d5db',
                                    fill: value <= Number(review?.rating || review?.stars || 0) ? '#d4af37' : 'transparent',
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="admin-review-meta-grid mt-3 grid grid-cols-2">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--admin-primary)' }}>
                              Cliente
                            </p>
                            <p className="text-sm" style={{ color: 'var(--admin-card-text)' }}>
                              {review?.name || review?.customerName || 'Sin nombre'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--admin-primary)' }}>
                              Fecha
                            </p>
                            <p className="text-sm" style={{ color: 'var(--admin-card-text)' }}>
                              {date && !Number.isNaN(date.getTime()) ? date.toLocaleString('es-CO') : 'Sin fecha'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <p className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: 'var(--admin-primary)' }}>
                            Comentario
                          </p>
                          <p className="text-sm leading-relaxed whitespace-pre-line break-words" style={{ color: 'var(--admin-card-muted-text)' }}>
                            {review?.comment || review?.text || 'Sin comentario'}
                          </p>
                        </div>
                      </div>

                      <div className="admin-review-actions shrink-0">
                        <button
                          type="button"
                          onClick={() => onDelete(productId, reviewId)}
                          disabled={!productId || deletingReviewId === reviewId}
                          className="admin-action-button-padding inline-flex items-center admin-inline-gap-sm rounded-[calc(var(--admin-radius)*0.55)] text-sm font-semibold text-white disabled:opacity-50 transition-all duration-200"
                          style={{ backgroundColor: 'var(--admin-danger)' }}
                          onMouseEnter={(e) => applyHoverColor(e, 'var(--admin-danger-hover)')}
                          onMouseLeave={(e) => applyHoverColor(e, 'var(--admin-danger)')}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deletingReviewId === reviewId ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  </div>
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
    if (isConfigRoute) {
      setConfigMenuOpen(true);
    }
  }, [isConfigRoute]);

  const handleLogout = () => {
    logout();
    setAdminToken(null);
    navigate('/admin/login');
  };

  const handleConfigMenuClick = () => {
    setConfigMenuOpen((prev) => !prev);
    if (!isConfigRoute) navigate(getFirstAllowedConfigPath(adminUser));
  };

  const fetchAdminReviews = async () => {
    try {
      setReviewsLoading(true);
      setReviewsError('');
      const res = await api.get('/api/products/admin/reviews');
      const rows = Array.isArray(res?.data?.reviews) ? res.data.reviews : [];
      setReviews(rows);
    } catch (error) {
      console.error('❌ Error al cargar reseñas admin:', error);
      setReviewsError(
        error?.response?.data?.message ||
          error?.userMessage ||
          'No se pudieron cargar las reseñas'
      );
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminReviews();
    const interval = setInterval(() => {
      fetchAdminReviews();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const unseenCount = useMemo(() => {
    const seen = new Set(getSeenReviewIds());
    return reviews.filter((review) => !seen.has(String(review.reviewId || ''))).length;
  }, [reviews]);

  const handleOpenReviewsModal = async () => {
    setReviewsModalOpen(true);
    await fetchAdminReviews();
    const ids = reviews
      .map((review) => String(review?.reviewId || '').trim())
      .filter(Boolean);
    if (ids.length) saveSeenReviewIds(ids);
  };

  useEffect(() => {
    if (!reviewsModalOpen) return;
    const ids = reviews
      .map((review) => String(review?.reviewId || '').trim())
      .filter(Boolean);
    if (ids.length) saveSeenReviewIds(ids);
  }, [reviewsModalOpen, reviews]);

  const handleDeleteReview = async (productId, reviewId) => {
    if (!productId || !reviewId) return;
    const ok = window.confirm(
      '¿Seguro que deseas eliminar esta reseña? Esta acción no se puede deshacer.'
    );
    if (!ok) return;

    try {
      setDeletingReviewId(String(reviewId));
      setReviewsError('');
      await api.delete(`/api/products/${productId}/reviews/${reviewId}`);
      setReviews((prev) =>
        prev.filter(
          (review) =>
            !(
              String(review?.productId || '') === String(productId) &&
              String(review?.reviewId || '') === String(reviewId)
            )
        )
      );
      const currentSeen = getSeenReviewIds().filter(
        (id) => String(id) !== String(reviewId)
      );
      saveSeenReviewIds(currentSeen);
    } catch (error) {
      console.error('❌ Error al eliminar reseña:', error);
      setReviewsError(
        error?.response?.data?.message ||
          error?.userMessage ||
          'No se pudo eliminar la reseña'
      );
    } finally {
      setDeletingReviewId('');
    }
  };

  const activeNavStyle = {
    background: 'var(--admin-active-nav-bg)',
    color: 'var(--admin-active-nav-text)',
    fontWeight: 700,
    boxShadow: 'var(--admin-shadow-active, 0 8px 24px rgba(0,0,0,0.12))',
    transform: 'translateY(-1px)',
  };

  const normalNavStyle = {
    color: 'var(--admin-primary-soft-text)',
  };

  const linkBase =
    'group flex items-center admin-nav-item-gap admin-nav-padding rounded-[calc(var(--admin-radius)*0.55)] transition-all duration-200 text-sm font-medium';

  const mobileLinkBase =
    'inline-flex items-center admin-mobile-nav-item-gap admin-nav-padding-mobile rounded-[calc(var(--admin-radius)*0.55)] text-sm font-medium whitespace-nowrap transition-all duration-200';

  const subLinkBase =
    'group flex items-center admin-subnav-item-gap rounded-[calc(var(--admin-radius)*0.5)] admin-nav-padding-sub text-sm transition-all duration-200 font-medium';

  return (
    <>
      <style>{`
        .admin-area {
          font-family: 'DM Sans', 'Outfit', system-ui, sans-serif;
        }

        .admin-layout-shell {
          padding: var(--admin-padding);
          gap: var(--admin-gap);
        }

        .admin-main-column {
          gap: var(--admin-gap);
        }

        .admin-sidebar-panel {
          border-radius: var(--admin-radius);
          padding: calc(var(--admin-padding) * 0.75);
        }

        .admin-content-card {
          border-radius: var(--admin-radius);
          padding: calc(var(--admin-padding) * 1.35);
        }

        .admin-header-panel {
          min-height: var(--admin-header-height);
          border-radius: calc(var(--admin-radius) * 0.9);
          padding: calc(var(--admin-padding) * 0.75) calc(var(--admin-padding) * 1.2);
          gap: var(--admin-gap);
        }

        .admin-mobile-header-panel {
          border-radius: calc(var(--admin-radius) * 0.85);
          padding: calc(var(--admin-padding) * 0.75);
          gap: calc(var(--admin-gap) * 0.6);
        }

        .admin-mobile-nav-panel {
          border-radius: calc(var(--admin-radius) * 0.85);
          padding: calc(var(--admin-padding) * 0.55);
          gap: calc(var(--admin-gap) * 0.45);
        }

        .admin-brand-card {
          border-radius: 0;
          padding: calc(var(--admin-padding) * 0.7);
          margin-bottom: calc(var(--admin-gap) * 1.2);
          position: relative;
          overflow: visible;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .admin-logo-floating {
          isolation: isolate;
        }

        .admin-logo-floating::before {
          content: "";
          position: absolute;
          width: 145px;
          height: 145px;
          border-radius: 999px;
          background: radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 34%, transparent), transparent 62%);
          filter: blur(18px);
          opacity: 0.9;
          z-index: -1;
        }

        .admin-logo-3d {
          transform-style: preserve-3d;
          transform: perspective(900px) rotateX(8deg) rotateY(-10deg) translateZ(0);
          filter: drop-shadow(0 18px 26px rgba(0,0,0,0.32)) drop-shadow(0 6px 10px rgba(0,0,0,0.2));
        }

        .admin-logo-3d:hover {
          transform: perspective(800px) translateY(-4px) scale(1.04);
          filter: drop-shadow(0 18px 40px rgba(0,0,0,0.35)) drop-shadow(0 8px 18px rgba(0,0,0,0.2));
        }

        .admin-section-label {
          color: var(--admin-card-muted-text);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: calc(var(--admin-gap) * 0.45);
          padding-left: calc(var(--admin-padding) * 0.25);
        }

        .admin-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: calc(var(--admin-radius) * 0.45);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--admin-primary-soft-bg);
          color: inherit;
          border: 1px solid var(--admin-primary-soft-border);
          flex-shrink: 0;
        }

        .admin-nav-link:hover {
          background: var(--admin-primary-soft-bg);
          color: var(--admin-card-text) !important;
          transform: translateY(-1px);
        }

        .admin-config-submenu {
          margin-left: calc(var(--admin-padding) * 0.7);
          margin-top: calc(var(--admin-gap) * 0.35);
          padding-left: calc(var(--admin-padding) * 0.45);
        }

        .admin-sidebar-footer {
          margin-top: calc(var(--admin-gap) * 1.2);
          padding-top: calc(var(--admin-padding) * 0.75);
        }

        .admin-logout-sidebar,
        .admin-btn-ghost,
        .admin-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          border-radius: calc(var(--admin-radius) * 0.55);
          font-size: 0.875rem;
          font-weight: 700;
          transition: all 0.18s ease;
        }

        .admin-logout-sidebar {
          width: 100%;
          padding: 0.75rem 1rem;
          color: var(--admin-primary-soft-text);
          background: var(--admin-primary-soft-bg);
          border: 1px solid var(--admin-primary-soft-border);
        }

        .admin-btn-ghost {
          position: relative;
          height: 42px;
          padding: 0 1rem;
          color: var(--admin-card-text);
          background: var(--admin-primary-soft-bg);
          border: 1px solid var(--admin-primary-soft-border);
        }

        .admin-btn-primary {
          height: 42px;
          padding: 0 1rem;
          color: var(--admin-primary-contrast, #fff);
          background: var(--admin-primary);
          border: 1px solid color-mix(in srgb, var(--admin-primary) 75%, transparent);
        }

        .admin-btn-ghost:hover,
        .admin-btn-primary:hover,
        .admin-logout-sidebar:hover {
          transform: translateY(-1px);
          box-shadow: var(--admin-shadow-active, 0 8px 24px rgba(0,0,0,0.12));
        }

        .admin-search-bar {
          height: 42px;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: calc(var(--admin-radius) * 0.65);
          background: var(--admin-input-bg, var(--admin-card-bg));
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0 0.9rem;
        }

        .admin-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
          background: var(--admin-primary);
          color: var(--admin-primary-contrast, #fff);
        }

        .admin-blob {
          position: absolute;
          border-radius: 999px;
          filter: blur(45px);
          pointer-events: none;
        }

        .admin-blob-2,
        .admin-blob-3 {
          mix-blend-mode: screen;
        }
      `}</style>

      <div
        className="admin-area min-h-screen relative overflow-hidden"
        style={{
          background: `
            radial-gradient(circle at 15% 18%, color-mix(in srgb, var(--admin-primary) 18%, transparent), transparent 42%),
            radial-gradient(circle at 88% 8%, rgba(255,255,255,0.12), transparent 38%),
            radial-gradient(circle at 75% 88%, color-mix(in srgb, var(--admin-primary) 10%, transparent), transparent 44%),
            linear-gradient(135deg, var(--admin-page-bg), color-mix(in srgb, var(--admin-page-bg) 88%, var(--admin-primary) 12%) 42%, var(--admin-page-bg) 100%)
          `,
        }}
      >
        <div
          className="admin-blob"
          style={{
            width: 520,
            height: 520,
            top: -140,
            left: -140,
            background: 'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 42%, transparent), transparent 70%)',
            opacity: 0.35,
          }}
        />
        <div
          className="admin-blob admin-blob-2"
          style={{
            width: 460,
            height: 460,
            top: '18%',
            right: '-110px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.32), transparent 70%)',
            opacity: 0.20,
          }}
        />
        <div
          className="admin-blob admin-blob-3"
          style={{
            width: 500,
            height: 500,
            bottom: '-120px',
            left: '38%',
            background: 'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 32%, transparent), transparent 70%)',
            opacity: 0.25,
          }}
        />

        <div className="admin-layout-shell relative z-10 flex min-h-screen">
          <aside
            className="admin-sidebar-glass admin-sidebar-panel hidden md:flex md:flex-col shrink-0"
            style={{ width: 'var(--admin-sidebar-width)' }}
          >
            <div className="admin-brand-card admin-logo-floating flex items-center justify-center min-h-[96px]">
              {adminBrandLogo ? (
                <img
                  src={adminBrandLogo}
                  alt=""
                  aria-hidden="true"
                  className="h-22 max-h-35 w-auto object-contain transition-all duration-300 admin-logo-3d"
                />
              ) : (
                <div className="flex items-center admin-inline-gap-sm">
                  <span
                    className="admin-logo-fallback-icon flex h-8 w-8 items-center justify-center"
                    style={{ background: 'var(--admin-primary)', color: '#fff' }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span className="text-base font-bold tracking-tight" style={{ color: 'var(--admin-card-text)' }}>
                    Panel Admin
                  </span>
                </div>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto admin-thin-scrollbar space-y-5 pr-0.5" aria-label="Menú lateral admin">
              {visibleMainLinks.length > 0 && (
                <div>
                  <p className="admin-section-label">Principal</p>
                  <div className="space-y-0.5">
                    {visibleMainLinks.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={`${linkBase} admin-nav-link`}
                          style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                        >
                          <span className="admin-icon-wrap">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}

              {visibleDesignLinks.length > 0 && (
                <div>
                  <p className="admin-section-label">Diseño</p>
                  <div className="space-y-0.5">
                    {visibleDesignLinks.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={`${linkBase} admin-nav-link`}
                          style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                        >
                          <span className="admin-icon-wrap">
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )}

              {hasVisibleConfigLinks && (
                <div>
                  <p className="admin-section-label">Sistema</p>
                  <button
                    type="button"
                    onClick={handleConfigMenuClick}
                    className={`${linkBase} admin-nav-link w-full justify-between`}
                    style={isConfigRoute ? activeNavStyle : normalNavStyle}
                  >
                    <span className="flex items-center admin-inline-gap-md">
                      <span className="admin-icon-wrap">
                        <Settings className="h-3.5 w-3.5" />
                      </span>
                      <span>Configuración</span>
                    </span>
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform duration-200"
                      style={{ transform: configMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>

                  {configMenuOpen && (
                    <div className="admin-config-submenu space-y-0.5 border-l" style={{ borderColor: 'var(--admin-card-border)' }}>
                      {visibleConfigSublinks.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={`${subLinkBase} admin-nav-link`}
                            style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </nav>

            <div className="admin-sidebar-footer" style={{ borderTop: '1px solid var(--admin-card-border)' }}>
              <button onClick={handleLogout} className="admin-logout-sidebar">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </aside>

          <main className="admin-main-column flex-1 min-w-0 flex flex-col">
            <header
              className="admin-header-glass admin-header-panel hidden md:flex items-center"
              style={{ boxShadow: 'var(--admin-shadow-header, 0 8px 32px rgba(0,0,0,0.06))' }}
            >
              <div className="shrink-0">
                <h1 className="text-base font-bold leading-tight" style={{ color: 'var(--admin-card-text)' }}>
                  Panel Administrativo
                </h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Gestiona tu tienda en tiempo real
                </p>
              </div>

              <div className="admin-search-bar flex-1 max-w-md mx-auto">
                <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
                <input
                  type="text"
                  placeholder="Buscar productos, órdenes, páginas..."
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'var(--admin-card-text)', caretColor: 'var(--admin-primary)' }}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="flex min-w-[210px] max-w-[260px] items-center gap-3 rounded-[calc(var(--admin-radius)*0.65)] border px-3 py-2"
                  style={{
                    borderColor: 'var(--admin-primary-soft-border)',
                    background: 'var(--admin-primary-soft-bg)',
                    color: 'var(--admin-primary-soft-text)',
                    boxShadow: 'var(--admin-shadow-sm, 0 4px 14px rgba(0,0,0,0.08))',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-xs font-black"
                    style={{
                      borderColor: 'var(--admin-primary-soft-border)',
                      background: 'var(--admin-card-bg)',
                      color: 'var(--admin-primary)',
                    }}
                  >
                    {activeAdminInitials || <UserRound className="h-4 w-4" />}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-black leading-4" style={{ color: 'var(--admin-card-text)' }}>
                      {activeAdminName}
                    </p>
                    <p className="truncate text-[11px] font-bold leading-4" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Perfil: {activeAdminRole}
                    </p>
                  </div>
                </div>

                <button type="button" onClick={handleOpenReviewsModal} className="admin-btn-ghost">
                  <Bell className="h-4 w-4" />
                  <span>Reseñas</span>
                  {unseenCount > 0 && <span className="admin-badge">{unseenCount}</span>}
                </button>

                <button onClick={handleLogout} className="admin-btn-primary">
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            </header>

            <div className="md:hidden space-y-3">
              <div className="admin-header-glass admin-mobile-header-panel flex items-center justify-between">
                <h1 className="text-base font-bold" style={{ color: 'var(--admin-card-text)' }}>
                  Panel Admin
                </h1>

                <div className="flex items-center admin-inline-gap-sm">
                  <button type="button" onClick={handleOpenReviewsModal} className="admin-btn-ghost relative" aria-label="Ver reseñas">
                    <Bell className="h-4 w-4" />
                    {unseenCount > 0 && <span className="admin-badge">{unseenCount}</span>}
                  </button>

                  <button onClick={handleLogout} className="admin-btn-primary">
                    <LogOut className="h-4 w-4" />
                    Salir
                  </button>
                </div>
              </div>

              <div className="admin-search-bar">
                <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
                <input
                  type="text"
                  placeholder="Buscar en el panel..."
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'var(--admin-card-text)' }}
                />
              </div>

              <nav className="admin-card-glass admin-mobile-nav-panel flex overflow-x-auto admin-no-scrollbar" aria-label="Tabs admin">
                {visibleMainLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`${mobileLinkBase} admin-nav-link-mobile`}
                      style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                    >
                      <span className="admin-icon-wrap" style={{ width: 26, height: 26, borderRadius: 'calc(var(--admin-radius) * 0.38)' }}>
                        <Icon className="h-3 w-3" />
                      </span>
                      {item.label}
                    </NavLink>
                  );
                })}

                {visibleDesignLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`${mobileLinkBase} admin-nav-link-mobile`}
                      style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                    >
                      <span className="admin-icon-wrap" style={{ width: 26, height: 26, borderRadius: 'calc(var(--admin-radius) * 0.38)' }}>
                        <Icon className="h-3 w-3" />
                      </span>
                      {item.label}
                    </NavLink>
                  );
                })}

                {hasVisibleConfigLinks && (
                  <button
                    type="button"
                    onClick={handleConfigMenuClick}
                    className={`${mobileLinkBase} admin-nav-link-mobile`}
                    style={isConfigRoute ? activeNavStyle : normalNavStyle}
                  >
                    <span className="admin-icon-wrap" style={{ width: 26, height: 26, borderRadius: 'calc(var(--admin-radius) * 0.38)' }}>
                      <Settings className="h-3 w-3" />
                    </span>
                    Config
                  </button>
                )}
              </nav>

              {hasVisibleConfigLinks && configMenuOpen && (
                <div className="flex flex-wrap px-1" style={{ gap: 'calc(var(--admin-gap) * 0.45)' }}>
                  {visibleConfigSublinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={`${mobileLinkBase} admin-nav-link-mobile`}
                        style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                      >
                        <Icon className="h-3 w-3" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>

            <section
              className="admin-card-glass admin-content-card flex-1"
              style={{
                minHeight: 'calc(100vh - var(--admin-header-height) - (var(--admin-padding) * 4))',
                boxShadow: 'var(--admin-shadow-content, 0 16px 48px rgba(0,0,0,0.06))',
              }}
            >
              <Outlet />
            </section>
          </main>
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
      </div>
    </>
  );
}
