// frontend/src/admin/orders/components/orderDetail/OrderDetailIcons.jsx

import {
  X,
  Download,
  FileText,
  Eye,
  User,
  ReceiptText,
  ShoppingBag,
  CreditCard,
  Building2,
  Store,
  Truck,
  Clock3,
  Tag,
  StickyNote,
  History,
  Mail,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  MoreHorizontal,
  PackageCheck,
  ClipboardList,
  ShieldCheck,
  Copy,
  ExternalLink,
  Zap,
  Settings2,
  Package,
  WalletCards,
  MessageCircle,
} from 'lucide-react';

export const OrderDetailIcons = {
  X,
  Download,
  FileText,
  Eye,
  User,
  ReceiptText,
  ShoppingBag,
  CreditCard,
  Building2,
  Store,
  Truck,
  Clock3,
  Tag,
  StickyNote,
  History,
  Mail,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  MoreHorizontal,
  PackageCheck,
  ClipboardList,
  ShieldCheck,
  Copy,
  ExternalLink,
  Zap,
  Settings2,
  Package,
  WalletCards,
  MessageCircle,
};

export function IconBadge({
  icon: Icon,
  size = 42,
  iconSize = 18,
  variant = 'primary',
  className = '',
}) {
  const variants = {
    primary: {
      background: 'var(--admin-primary-soft-bg)',
      color: 'var(--admin-primary)',
      borderColor: 'var(--admin-card-border)',
    },
    soft: {
      background: 'var(--admin-input-bg)',
      color: 'var(--admin-card-muted-text)',
      borderColor: 'var(--admin-card-border)',
    },
    success: {
      background: 'rgba(34, 197, 94, 0.12)',
      color: '#16a34a',
      borderColor: 'rgba(34, 197, 94, 0.25)',
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#d97706',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
  };

  const current = variants[variant] || variants.primary;

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: current.background,
        color: current.color,
        border: `1px solid ${current.borderColor}`,
      }}
    >
      {Icon ? <Icon size={iconSize} strokeWidth={2.25} /> : null}
    </span>
  );
}

export function InlineIcon({ icon: Icon, size = 15, strokeWidth = 2.2 }) {
  if (!Icon) return null;

  return <Icon size={size} strokeWidth={strokeWidth} />;
}
