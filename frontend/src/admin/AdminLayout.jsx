// src/admin/AdminLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Fingerprint,
  Command,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { applyAdminTheme } from './theme/adminTheme';
import { applyAdminLayoutStyles } from './theme/adminLayoutStyles';
import { applyAdminGlobalStyles } from './theme/adminGlobalStyles';
import { installAdminModalContract } from './theme/adminModalContract';
import { canAccessAdminPath } from './security/adminPermissions';
import './theme/adminModuleHero.css';

const ADMIN_REVIEW_SEEN_KEY = 'admin_seen_review_ids';

const CONFIG_SUBLINKS = [
  { to: '/admin/configuracion/empresa', label: 'Tienda', icon: Store },
  { to: '/admin/configuracion/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/admin/configuracion/envios', label: 'Envíos', icon: Truck },
  { to: '/admin/configuracion/correo', label: 'Correo', icon: Mail },
  { to: '/admin/configuracion/login-admin', label: 'Login admin', icon: ShieldCheck },
  { to: '/admin/configuracion/panel-admin', label: 'Panel admin', icon: Settings },
  { to: '/admin/configuracion/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/configuracion/perfiles', label: 'Perfiles', icon: UserCog },
  { to: '/admin/configuracion/seguridad', label: 'Seguridad', icon: Fingerprint },
  { to: '/admin/configuracion/sedes', label: 'Sedes', icon: Building2 },
  { to: '/admin/configuracion/logs', label: 'Logs', icon: ScrollText },
];

function applyHoverColor(e, color) {
  e.currentTarget.style.backgroundColor = color;
}

function normalizeAdminSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

function filterLinksByPermission(adminUser, links) {
  return links.filter((item) => canAccessAdminPath(adminUser, item.to));
}

function getFirstAllowedConfigPath(adminUser) {
  const firstAllowedConfigLink = filterLinksByPermission(adminUser, CONFIG_SUBLINKS)[0];

  return firstAllowedConfigLink?.to || '/admin/dashboard';
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
  const twoFactorSetupRequired = Boolean(adminUser?.twoFactorSetupRequired);
  const [configMenuOpen, setConfigMenuOpen] = useState(isConfigRoute);

  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviews, setReviews] = useState([]);
  const [deletingReviewId, setDeletingReviewId] = useState('');
  const [adminBrandLogo, setAdminBrandLogo] = useState('');
  const [commandQuery, setCommandQuery] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const commandInputRef = useRef(null);

  useEffect(() => installAdminModalContract(), []);

  useEffect(() => {
    if (
      twoFactorSetupRequired &&
      location.pathname !== '/admin/configuracion/seguridad'
    ) {
      navigate('/admin/configuracion/seguridad', { replace: true });
    }
  }, [location.pathname, navigate, twoFactorSetupRequired]);

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
    void logout();
    navigate('/admin/login');
  };

  const handleConfigMenuClick = () => {
    setConfigMenuOpen((prev) => !prev);
    navigate(getFirstAllowedConfigPath(adminUser));
  };

  const getSeenReviewIds = () => {
    try {
      const raw = localStorage.getItem(ADMIN_REVIEW_SEEN_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  };

  const saveSeenReviewIds = (ids) => {
    try {
      localStorage.setItem(ADMIN_REVIEW_SEEN_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
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

  const mainLinks = [
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

  const designLinks = [
    { to: '/admin/apariencia', label: 'Apariencia', icon: Palette },
    { to: '/admin/paginas', label: 'Páginas', icon: FileText },
  ];

  const visibleMainLinks = filterLinksByPermission(adminUser, mainLinks);
  const visibleDesignLinks = filterLinksByPermission(adminUser, designLinks);
  const visibleConfigSublinks = filterLinksByPermission(adminUser, CONFIG_SUBLINKS);
  const hasVisibleConfigLinks = visibleConfigSublinks.length > 0;

  const commandItems = [
    ...visibleMainLinks.map((item) => ({ ...item, group: 'Operación' })),
    ...visibleDesignLinks.map((item) => ({ ...item, group: 'Diseño' })),
    ...visibleConfigSublinks.map((item) => ({ ...item, group: 'Configuración' })),
  ];

  const normalizedCommandQuery = normalizeAdminSearch(commandQuery);
  const filteredCommandItems = commandItems
    .filter((item) => {
      if (!normalizedCommandQuery) return true;
      return normalizeAdminSearch(`${item.label} ${item.group}`).includes(
        normalizedCommandQuery
      );
    })
    .slice(0, 7);

  const activeCommandItem = [...commandItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find(
      (item) =>
        location.pathname === item.to ||
        location.pathname.startsWith(`${item.to}/`)
    );

  const headerQuickActions = [
    { to: '/admin/pos', label: 'Venta POS', icon: Store },
    { to: '/admin/ordenes', label: 'Órdenes', icon: ClipboardList },
    { to: '/admin/inventario', label: 'Stock', icon: PackageSearch },
  ].filter((item) => canAccessAdminPath(adminUser, item.to));

  const handleCommandSelect = (path) => {
    setCommandQuery('');
    setCommandOpen(false);
    navigate(path);
  };

  useEffect(() => {
    const handleCommandShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        commandInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

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

        .admin-brand-float {
          min-height: 132px;
          padding: calc(var(--admin-padding) * 0.35) 0 calc(var(--admin-padding) * 0.6);
          margin-bottom: calc(var(--admin-gap) * 0.7);
          position: relative;
          overflow: visible;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          outline: none !important;
          transform-style: preserve-3d;
          perspective: 900px;
        }

        .admin-logo-floating {
          isolation: isolate;
        }

        .admin-nav-padding {
          padding: calc(var(--admin-padding) * 0.52) calc(var(--admin-padding) * 0.72);
        }

        .admin-nav-padding-mobile {
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.65);
        }

        .admin-nav-padding-sub {
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.65);
        }

        .admin-nav-item-gap {
          gap: calc(var(--admin-gap) * 0.65);
        }

        .admin-mobile-nav-item-gap {
          gap: calc(var(--admin-gap) * 0.45);
        }

        .admin-subnav-item-gap {
          gap: calc(var(--admin-gap) * 0.45);
        }

        .admin-inline-gap-sm {
          gap: calc(var(--admin-gap) * 0.45);
        }

        .admin-inline-gap-md {
          gap: calc(var(--admin-gap) * 0.65);
        }

        .admin-inline-gap-xs {
          gap: calc(var(--admin-gap) * 0.18);
        }

        .admin-stack-gap-sm {
          gap: calc(var(--admin-gap) * 0.45);
        }

        .admin-stack-gap-md {
          gap: calc(var(--admin-gap) * 0.8);
        }

        .admin-sidebar-footer {
          margin-top: var(--admin-gap);
          padding-top: calc(var(--admin-padding) * 0.7);
        }

        .admin-config-submenu {
          margin-top: calc(var(--admin-gap) * 0.28);
          margin-left: calc(var(--admin-padding) * 0.9);
          padding-left: calc(var(--admin-padding) * 0.7);
        }

        .admin-modal-overlay {
          padding: var(--admin-padding);
        }

        .admin-modal-header {
          padding: calc(var(--admin-padding) * 1.05) calc(var(--admin-padding) * 1.25);
          gap: var(--admin-gap);
        }

        .admin-modal-body {
          padding: calc(var(--admin-padding) * 1.05) calc(var(--admin-padding) * 1.25);
        }

        .admin-modal-error {
          margin-bottom: var(--admin-gap);
          border-radius: calc(var(--admin-radius) * 0.55);
          padding: calc(var(--admin-padding) * 0.7) calc(var(--admin-padding) * 0.85);
        }

        .admin-review-list {
          gap: calc(var(--admin-gap) * 0.7);
        }

        .admin-review-card {
          border-radius: calc(var(--admin-radius) * 0.8);
          padding: calc(var(--admin-padding) * 1.05);
        }

        .admin-review-meta-grid {
          gap: calc(var(--admin-gap) * 0.8);
        }

        .admin-review-actions {
          padding-left: calc(var(--admin-padding) * 0.9);
        }

        .admin-action-button-padding {
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.85);
        }

        .admin-logo-fallback-icon {
          border-radius: calc(var(--admin-radius) * 0.5);
        }

        .admin-small-image-radius {
          border-radius: calc(var(--admin-radius) * 0.5);
        }

        .admin-no-scrollbar::-webkit-scrollbar { display: none; }
        .admin-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .admin-thin-scrollbar::-webkit-scrollbar { width: 4px; }
        .admin-thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .admin-thin-scrollbar::-webkit-scrollbar-thumb {
          background: var(--admin-card-border);
          border-radius: 99px;
        }

        .admin-nav-link:hover {
          background: var(--admin-primary-soft-bg) !important;
          color: var(--admin-primary) !important;
          transform: translateX(3px);
        }

        .admin-nav-link-mobile:hover {
          background: var(--admin-primary-soft-bg) !important;
          color: var(--admin-primary) !important;
        }

        .admin-sidebar-glass {
          background: var(--admin-sidebar-bg);
          border: 1px solid var(--admin-card-border);
          backdrop-filter: blur(24px) saturate(1.8);
          -webkit-backdrop-filter: blur(24px) saturate(1.8);
        }

        .admin-header-glass {
          background: var(--admin-header-bg);
          border: 1px solid var(--admin-card-border);
          backdrop-filter: blur(20px) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) saturate(1.6);
        }

        .admin-card-glass {
          background: var(--admin-card-bg);
          border: 1px solid var(--admin-card-border);
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
        }

        .admin-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }

        @keyframes adminBlobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -15px) scale(1.04); }
          66% { transform: translate(-10px, 12px) scale(0.97); }
        }

        .admin-blob { animation: adminBlobFloat 14s ease-in-out infinite; }
        .admin-blob-2 { animation-delay: -5s; animation-duration: 18s; }
        .admin-blob-3 { animation-delay: -9s; animation-duration: 22s; }

        .admin-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: calc(var(--admin-radius) * 0.42);
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary);
          flex-shrink: 0;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .admin-nav-link:hover .admin-icon-wrap,
        .admin-nav-link-mobile:hover .admin-icon-wrap {
          transform: scale(1.1);
          box-shadow: var(--admin-shadow-sm, 0 4px 12px rgba(0,0,0,0.1));
        }

        .admin-section-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--admin-card-muted-text);
          padding: 0 calc(var(--admin-padding) * 0.7);
          margin-bottom: calc(var(--admin-gap) * 0.35);
          opacity: 0.7;
        }

        .admin-divider {
          height: 1px;
          background: var(--admin-card-border);
          margin: calc(var(--admin-gap) * 0.7) 0;
          opacity: 0.5;
        }

        .admin-badge {
          position: absolute;
          top: -7px;
          right: -7px;
          min-width: 20px;
          height: 20px;
          padding: 0 5px;
          border-radius: 99px;
          background: var(--admin-primary);
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--admin-shadow-badge, 0 2px 8px rgba(0,0,0,0.18));
        }

        .admin-search-bar {
          position: relative;
          display: flex;
          align-items: center;
          gap: calc(var(--admin-gap) * 0.6);
          background: var(--admin-card-bg);
          border: 1px solid var(--admin-card-border);
          border-radius: calc(var(--admin-radius) * 0.65);
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.75);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .admin-search-bar:focus-within {
          border-color: var(--admin-primary);
          box-shadow: 0 0 0 3px var(--admin-primary-soft-bg);
        }

        .admin-header-panel {
          grid-template-columns: minmax(150px, 0.65fr) minmax(280px, 1.35fr) auto;
          align-items: center;
          overflow: visible;
        }

        .admin-header-context {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .admin-header-context__eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--admin-primary);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .admin-header-context h1 {
          margin: 0;
          color: var(--admin-card-text);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(17px, 1.55vw, 22px);
          line-height: 1.05;
        }

        .admin-header-context p {
          margin: 0;
          overflow: hidden;
          color: var(--admin-card-muted-text);
          font-size: 10px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-command-center {
          position: relative;
          min-width: 0;
        }

        .admin-command-center .admin-search-bar {
          width: 100%;
          max-width: none;
          min-height: 42px;
          margin: 0;
          padding-right: 8px;
          background: color-mix(in srgb, var(--admin-card-bg) 78%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.56);
        }

        .admin-command-center kbd {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          flex: 0 0 auto;
          border: 1px solid var(--admin-card-border);
          border-radius: 8px;
          padding: 4px 7px;
          background: var(--admin-primary-soft-bg);
          color: var(--admin-card-muted-text);
          font: 800 9px/1 'DM Sans', sans-serif;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
        }

        .admin-command-results {
          position: absolute;
          z-index: 80;
          top: calc(100% + 9px);
          right: 0;
          left: 0;
          display: grid;
          gap: 5px;
          max-height: 344px;
          overflow-y: auto;
          border: 1px solid var(--admin-widget-surface-border);
          border-radius: calc(var(--admin-radius) * .72);
          padding: 9px;
          background: color-mix(in srgb, var(--admin-card-bg) 92%, transparent);
          color: var(--admin-card-text);
          box-shadow: 0 24px 60px rgba(54, 31, 48, .2), inset 0 1px 0 rgba(255,255,255,.78);
          backdrop-filter: blur(28px) saturate(1.55);
          -webkit-backdrop-filter: blur(28px) saturate(1.55);
        }

        .admin-command-results__label {
          padding: 4px 7px 6px;
          color: var(--admin-card-muted-text);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .admin-command-result {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) 24px;
          align-items: center;
          gap: 9px;
          width: 100%;
          border: 1px solid transparent;
          border-radius: calc(var(--admin-radius) * .48);
          padding: 7px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .admin-command-result:hover,
        .admin-command-result:focus-visible {
          border-color: var(--admin-primary-soft-border);
          background: var(--admin-primary-soft-bg);
          outline: none;
        }

        .admin-command-result__icon {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: 11px;
          background: color-mix(in srgb, var(--admin-card-bg) 84%, transparent);
          color: var(--admin-primary);
        }

        .admin-command-result strong,
        .admin-command-result small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-command-result strong { font-size: 12px; }
        .admin-command-result small { margin-top: 2px; color: var(--admin-card-muted-text); font-size: 9px; }
        .admin-command-result > svg { color: var(--admin-primary); opacity: .72; }

        .admin-command-empty {
          padding: 16px 10px;
          color: var(--admin-card-muted-text);
          font-size: 12px;
          font-weight: 700;
          text-align: center;
        }

        .admin-header-actions {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .admin-process-shortcuts {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1px solid var(--admin-card-border);
          border-radius: calc(var(--admin-radius) * .6);
          padding: 4px;
          background: color-mix(in srgb, var(--admin-card-bg) 66%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.58);
        }

        .admin-process-shortcut {
          display: inline-flex;
          min-height: 32px;
          align-items: center;
          gap: 5px;
          border-radius: calc(var(--admin-radius) * .4);
          padding: 0 8px;
          color: var(--admin-card-muted-text);
          font-size: 10px;
          font-weight: 900;
          transition: background .18s ease, color .18s ease, transform .18s ease;
        }

        .admin-process-shortcut:hover,
        .admin-process-shortcut.active {
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary);
          transform: translateY(-1px);
        }

        .admin-profile-compact {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr);
          align-items: center;
          gap: 8px;
          width: 148px;
          min-height: 42px;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: calc(var(--admin-radius) * .6);
          padding: 4px 9px 4px 5px;
          background: var(--admin-primary-soft-bg);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.62);
        }

        .admin-profile-compact__avatar {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: 12px;
          background: color-mix(in srgb, var(--admin-card-bg) 86%, transparent);
          color: var(--admin-primary);
          font-size: 10px;
          font-weight: 950;
        }

        .admin-profile-compact p {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-profile-compact p:first-child { color: var(--admin-card-text); font-size: 10px; font-weight: 900; }
        .admin-profile-compact p:last-child { color: var(--admin-card-muted-text); font-size: 9px; font-weight: 750; }

        .admin-header-icon-button {
          display: grid;
          position: relative;
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          place-items: center;
          border: 1px solid var(--admin-primary-soft-border);
          border-radius: calc(var(--admin-radius) * .55);
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary-soft-text);
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .admin-header-icon-button:hover {
          background: var(--admin-primary-soft-hover);
          box-shadow: var(--admin-shadow-sm);
          transform: translateY(-1px);
        }

        .admin-header-icon-button--exit {
          background: var(--admin-primary);
          color: #fff;
        }

        @media (max-width: 1380px) {
          .admin-header-panel { grid-template-columns: 132px minmax(230px, 1fr) auto; }
          .admin-process-shortcut span { display: none; }
          .admin-process-shortcut { width: 32px; justify-content: center; padding: 0; }
          .admin-profile-compact { width: 42px; grid-template-columns: 34px; padding: 3px; }
          .admin-profile-compact > div:last-child { display: none; }
        }

        .admin-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: calc(var(--admin-gap) * 0.45);
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.8);
          border-radius: calc(var(--admin-radius) * 0.55);
          font-size: 13px;
          font-weight: 600;
          border: 1px solid var(--admin-primary-soft-border);
          background: var(--admin-primary-soft-bg);
          color: var(--admin-primary-soft-text);
          cursor: pointer;
          transition: all 0.18s ease;
          position: relative;
        }

        .admin-btn-ghost:hover {
          background: var(--admin-primary-soft-hover);
          transform: translateY(-1px);
          box-shadow: var(--admin-shadow-sm, 0 4px 14px rgba(0,0,0,0.08));
        }

        .admin-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: calc(var(--admin-gap) * 0.45);
          padding: calc(var(--admin-padding) * 0.45) calc(var(--admin-padding) * 0.8);
          border-radius: calc(var(--admin-radius) * 0.55);
          font-size: 13px;
          font-weight: 600;
          background: var(--admin-primary);
          color: #fff;
          cursor: pointer;
          border: none;
          transition: all 0.18s ease;
        }

        .admin-btn-primary:hover {
          background: var(--admin-primary-hover);
          transform: translateY(-1px);
          box-shadow: var(--admin-shadow-sm, 0 4px 14px rgba(0,0,0,0.14));
        }

        .admin-logout-sidebar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: calc(var(--admin-gap) * 0.45);
          width: 100%;
          padding: calc(var(--admin-padding) * 0.6) calc(var(--admin-padding) * 0.9);
          border-radius: calc(var(--admin-radius) * 0.65);
          font-size: 13px;
          font-weight: 600;
          background: var(--admin-primary);
          color: #fff;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
        }

        .admin-logout-sidebar:hover {
          background: var(--admin-primary-hover);
          box-shadow: var(--admin-shadow-md, 0 6px 20px rgba(0,0,0,0.15));
          transform: translateY(-1px);
        }

        .admin-modal-card {
          border-radius: calc(var(--admin-radius) * 1.1);
        }

        @media (max-width: 767px) {
          .admin-layout-shell {
            padding: calc(var(--admin-padding) * 0.75);
            gap: calc(var(--admin-gap) * 0.8);
          }

          .admin-main-column {
            gap: calc(var(--admin-gap) * 0.8);
          }

          .admin-content-card {
            padding: calc(var(--admin-padding) * 0.9);
          }

          .admin-modal-header,
          .admin-modal-body {
            padding: calc(var(--admin-padding) * 0.9);
          }

          .admin-review-actions {
            padding-left: 0;
          }
        }

        .admin-logo-3d {
          position: relative;
          z-index: 2;
          width: auto;
          max-width: 92%;
          max-height: 138px;
          filter:
            drop-shadow(0 20px 18px rgba(65, 35, 55, .22))
            drop-shadow(0 7px 7px color-mix(in srgb, var(--admin-primary) 32%, transparent))
            drop-shadow(0 -2px 2px rgba(255,255,255,.78));
          transform: perspective(900px) rotateX(2deg) rotateY(-3deg) translateZ(26px);
          transform-origin: center;
          transition: transform 0.35s cubic-bezier(.22,1,.36,1), filter .35s ease;
        }

        .admin-logo-3d:hover {
          transform: perspective(900px) rotateX(-1deg) rotateY(3deg) translateY(-5px) translateZ(34px) scale(1.035);
          filter:
            drop-shadow(0 26px 22px rgba(65, 35, 55, .26))
            drop-shadow(0 9px 9px color-mix(in srgb, var(--admin-primary) 38%, transparent))
            drop-shadow(0 -2px 2px rgba(255,255,255,.9));
        }
      `}</style>

      <div
        className="admin-area min-h-screen relative"
        style={{
          overflowX: 'clip',
          background: `
            radial-gradient(
              circle at 15% 18%,
              color-mix(in srgb, var(--admin-primary) 18%, transparent),
              transparent 42%
            ),
            radial-gradient(
              circle at 88% 8%,
              rgba(255, 255, 255, 0.12),
              transparent 38%
            ),
            radial-gradient(
              circle at 75% 88%,
              color-mix(in srgb, var(--admin-primary) 10%, transparent),
              transparent 44%
            ),
            linear-gradient(
              135deg,
              var(--admin-page-bg),
              color-mix(in srgb, var(--admin-page-bg) 88%, var(--admin-primary) 12%) 42%,
              var(--admin-page-bg) 100%
            )
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
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 42%, transparent), transparent 70%)',
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
            background:
              'radial-gradient(circle, rgba(255,255,255,0.32), transparent 70%)',
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
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 32%, transparent), transparent 70%)',
            opacity: 0.25,
          }}
        />

        <div className="admin-layout-shell relative z-10 flex min-h-screen">
          <aside
            className="admin-sidebar-glass admin-sidebar-panel hidden md:flex md:flex-col shrink-0"
            style={{ width: 'var(--admin-sidebar-width)' }}
          >
            <div className="admin-brand-float admin-logo-floating flex items-center justify-center">
              {adminBrandLogo ? (
                <img
                  src={adminBrandLogo}
                  alt=""
                  aria-hidden="true"
                  className="w-auto object-contain admin-logo-3d"
                />
              ) : (
                <div className="flex items-center admin-inline-gap-sm">
                  <span
                    className="admin-logo-fallback-icon flex h-8 w-8 items-center justify-center"
                    style={{ background: 'var(--admin-primary)', color: '#fff' }}
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span
                    className="text-base font-bold tracking-tight"
                    style={{ color: 'var(--admin-card-text)' }}
                  >
                    Panel Admin
                  </span>
                </div>
              )}
            </div>

            <nav
              className="flex-1 overflow-y-auto admin-thin-scrollbar space-y-5 pr-0.5"
              aria-label="Menú lateral admin"
            >
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
                    <div
                      className="admin-config-submenu space-y-0.5 border-l"
                      style={{ borderColor: 'var(--admin-card-border)' }}
                    >
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

            <div
              className="admin-sidebar-footer"
              style={{ borderTop: '1px solid var(--admin-card-border)' }}
            >
              <button onClick={handleLogout} className="admin-logout-sidebar">
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </aside>

          <main className="admin-main-column flex-1 min-w-0 flex flex-col">
            <header
              className="admin-header-glass admin-header-panel hidden md:grid"
              style={{ boxShadow: 'var(--admin-shadow-header, 0 8px 32px rgba(0,0,0,0.06))' }}
            >
              <div className="admin-header-context">
                <span className="admin-header-context__eyebrow">
                  <Command className="h-3 w-3" /> Centro operativo
                </span>
                <h1>{activeCommandItem?.label || 'Panel administrativo'}</h1>
                <p>{activeCommandItem?.group || 'Gestión integral'} · operación en tiempo real</p>
              </div>

              <div className="admin-command-center">
                <div className="admin-search-bar">
                  <Search
                    className="h-4 w-4 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />
                  <input
                    ref={commandInputRef}
                    type="search"
                    value={commandQuery}
                    onChange={(event) => {
                      setCommandQuery(event.target.value);
                      setCommandOpen(true);
                    }}
                    onFocus={() => setCommandOpen(true)}
                    onBlur={() => window.setTimeout(() => setCommandOpen(false), 120)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setCommandOpen(false);
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Enter' && filteredCommandItems[0]) {
                        event.preventDefault();
                        handleCommandSelect(filteredCommandItems[0].to);
                      }
                    }}
                    placeholder="Ir a productos, órdenes, caja, configuración..."
                    aria-label="Buscar y abrir un módulo del panel"
                    aria-expanded={commandOpen}
                    className="w-full bg-transparent text-sm outline-none"
                    style={{
                      color: 'var(--admin-card-text)',
                      caretColor: 'var(--admin-primary)',
                    }}
                  />
                  <kbd><Command className="h-2.5 w-2.5" /> K</kbd>
                </div>

                {commandOpen && (
                  <div className="admin-command-results" role="listbox">
                    <div className="admin-command-results__label">Navegación inteligente</div>
                    {filteredCommandItems.length > 0 ? (
                      filteredCommandItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.to}
                            type="button"
                            role="option"
                            aria-selected={item.to === activeCommandItem?.to}
                            className="admin-command-result"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleCommandSelect(item.to)}
                          >
                            <span className="admin-command-result__icon"><Icon className="h-4 w-4" /></span>
                            <span><strong>{item.label}</strong><small>{item.group}</small></span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        );
                      })
                    ) : (
                      <div className="admin-command-empty">No hay módulos que coincidan.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="admin-header-actions">
                {headerQuickActions.length > 0 && (
                  <div className="admin-process-shortcuts" aria-label="Procesos rápidos">
                    {headerQuickActions.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          title={`Abrir ${item.label}`}
                          className={`admin-process-shortcut${isActive ? ' active' : ''}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                <div className="admin-profile-compact" title={`${activeAdminName} · ${activeAdminRole}`}>
                  <div className="admin-profile-compact__avatar">
                    {activeAdminInitials || <UserRound className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p>{activeAdminName}</p>
                    <p>Perfil: {activeAdminRole}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenReviewsModal}
                  className="admin-header-icon-button"
                  aria-label="Abrir reseñas"
                  title="Reseñas y alertas"
                >
                  <Bell className="h-4 w-4" />
                  {unseenCount > 0 && (
                    <span className="admin-badge">{unseenCount}</span>
                  )}
                </button>

                <button
                  onClick={handleLogout}
                  className="admin-header-icon-button admin-header-icon-button--exit"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="md:hidden space-y-3">
              <div className="admin-header-glass admin-mobile-header-panel flex items-center justify-between">
                <h1
                  className="text-base font-bold"
                  style={{ color: 'var(--admin-card-text)' }}
                >
                  Panel Admin
                </h1>

                <div className="flex items-center admin-inline-gap-sm">
                  <button
                    type="button"
                    onClick={handleOpenReviewsModal}
                    className="admin-btn-ghost relative"
                    aria-label="Ver reseñas"
                  >
                    <Bell className="h-4 w-4" />
                    {unseenCount > 0 && (
                      <span className="admin-badge">{unseenCount}</span>
                    )}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="admin-btn-primary"
                  >
                    <LogOut className="h-4 w-4" />
                    Salir
                  </button>
                </div>
              </div>

              <div className="admin-search-bar">
                <Search
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                />
                <input
                  type="text"
                  placeholder="Buscar en el panel..."
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'var(--admin-card-text)' }}
                />
              </div>

              <nav
                className="admin-card-glass admin-mobile-nav-panel flex overflow-x-auto admin-no-scrollbar"
                aria-label="Tabs admin"
              >
                {visibleMainLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`${mobileLinkBase} admin-nav-link-mobile`}
                      style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
                    >
                      <span
                        className="admin-icon-wrap"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 'calc(var(--admin-radius) * 0.38)',
                        }}
                      >
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
                      <span
                        className="admin-icon-wrap"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 'calc(var(--admin-radius) * 0.38)',
                        }}
                      >
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
                    <span
                      className="admin-icon-wrap"
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 'calc(var(--admin-radius) * 0.38)',
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </span>
                    Config
                  </button>
                )}
              </nav>

              {hasVisibleConfigLinks && configMenuOpen && (
                <div
                  className="flex flex-wrap px-1"
                  style={{ gap: 'calc(var(--admin-gap) * 0.45)' }}
                >
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

        {reviewsModalOpen && (
          <div className="admin-modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div
              className="admin-card-glass admin-modal-card w-full max-w-5xl max-h-[88vh] overflow-hidden"
              style={{ boxShadow: 'var(--admin-shadow-modal, 0 32px 80px rgba(0,0,0,0.18))' }}
            >
              <div
                className="admin-modal-header flex items-center justify-between"
                style={{
                  borderBottom: '1px solid var(--admin-card-border)',
                }}
              >
                <div>
                  <h2
                    className="text-xl font-bold"
                    style={{ color: 'var(--admin-card-text)' }}
                  >
                    Reseñas de productos
                  </h2>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    Revisa y modera las reseñas del catálogo
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setReviewsModalOpen(false)}
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
                {reviewsError ? (
                  <div className="admin-modal-error border border-red-200 bg-red-50 text-sm text-red-700">
                    {reviewsError}
                  </div>
                ) : null}

                {reviewsLoading ? (
                  <div
                    className="py-12 text-center text-sm"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    Cargando reseñas...
                  </div>
                ) : reviews.length === 0 ? (
                  <div
                    className="py-12 text-center text-sm"
                    style={{ color: 'var(--admin-card-muted-text)' }}
                  >
                    No hay reseñas registradas todavía.
                  </div>
                ) : (
                  <div className="admin-review-list max-h-[62vh] overflow-y-auto admin-thin-scrollbar pr-1 flex flex-col">
                    {reviews.map((review, index) => {
                      const date = review?.createdAt ? new Date(review.createdAt) : null;

                      return (
                        <div
                          key={`${review?.reviewId || index}`}
                          className="admin-review-card border transition-all duration-200"
                          style={{
                            backgroundColor: 'var(--admin-primary-soft-bg)',
                            borderColor: 'var(--admin-primary-soft-border)',
                          }}
                        >
                          <div
                            className="flex flex-col lg:flex-row lg:items-start lg:justify-between"
                            style={{ gap: 'var(--admin-gap)' }}
                          >
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
                                  <p
                                    className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                                    style={{ color: 'var(--admin-primary)' }}
                                  >
                                    Producto
                                  </p>
                                  <h3
                                    className="font-semibold text-sm break-words leading-snug"
                                    style={{ color: 'var(--admin-card-text)' }}
                                  >
                                    {review?.productTitle || 'Sin título'}
                                  </h3>
                                  <div className="mt-1.5 flex items-center admin-inline-gap-xs">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <Star
                                        key={value}
                                        className="w-3.5 h-3.5"
                                        style={{
                                          color: value <= Number(review?.rating || 0) ? '#d4af37' : '#d1d5db',
                                          fill: value <= Number(review?.rating || 0) ? '#d4af37' : 'transparent',
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="admin-review-meta-grid mt-3 grid grid-cols-2">
                                <div>
                                  <p
                                    className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                                    style={{ color: 'var(--admin-primary)' }}
                                  >
                                    Cliente
                                  </p>
                                  <p
                                    className="text-sm"
                                    style={{ color: 'var(--admin-card-text)' }}
                                  >
                                    {review?.name || 'Sin nombre'}
                                  </p>
                                </div>
                                <div>
                                  <p
                                    className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                                    style={{ color: 'var(--admin-primary)' }}
                                  >
                                    Fecha
                                  </p>
                                  <p
                                    className="text-sm"
                                    style={{ color: 'var(--admin-card-text)' }}
                                  >
                                    {date && !Number.isNaN(date.getTime())
                                      ? date.toLocaleString('es-CO')
                                      : 'Sin fecha'}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3">
                                <p
                                  className="text-[10px] uppercase tracking-wider font-bold mb-0.5"
                                  style={{ color: 'var(--admin-primary)' }}
                                >
                                  Comentario
                                </p>
                                <p
                                  className="text-sm leading-relaxed whitespace-pre-line break-words"
                                  style={{ color: 'var(--admin-card-muted-text)' }}
                                >
                                  {review?.comment || 'Sin comentario'}
                                </p>
                              </div>
                            </div>

                            <div className="admin-review-actions shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteReview(review?.productId, review?.reviewId)
                                }
                                disabled={deletingReviewId === String(review?.reviewId || '')}
                                className="admin-action-button-padding inline-flex items-center admin-inline-gap-sm rounded-[calc(var(--admin-radius)*0.55)] text-sm font-semibold text-white disabled:opacity-50 transition-all duration-200"
                                style={{ backgroundColor: 'var(--admin-danger)' }}
                                onMouseEnter={(e) =>
                                  applyHoverColor(e, 'var(--admin-danger-hover)')
                                }
                                onMouseLeave={(e) =>
                                  applyHoverColor(e, 'var(--admin-danger)')
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                                {deletingReviewId === String(review?.reviewId || '')
                                  ? 'Eliminando...'
                                  : 'Eliminar'}
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
        )}
      </div>
    </>
  );
}
