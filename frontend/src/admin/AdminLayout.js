// frontend/src/admin/AdminLayout.js

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { Store, UserRound, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OriginalAdminLayout from './AdminLayout.jsx';
import { canAccessAdminPath } from './security/adminPermissions';

const MAIN_MENU_ORDER = [
  '/admin/dashboard',
  '/admin/productos',
  '/admin/ordenes',
  '/admin/clientes',
  '/admin/pos',
  '/admin/caja',
  '/admin/inventario',
  '/admin/carritos',
  '/admin/favoritos',
];

const EXTRA_MAIN_LINKS = [
  {
    key: 'clientes',
    path: '/admin/clientes',
    label: 'Clientes',
    mobileLabel: 'Clientes',
    icon: UserRound,
    slotAfter: '/admin/ordenes',
  },
  {
    key: 'pos',
    path: '/admin/pos',
    label: 'POS / Ventas físicas',
    mobileLabel: 'POS',
    icon: Store,
    slotAfter: '/admin/clientes',
  },
  {
    key: 'caja',
    path: '/admin/caja',
    label: 'Caja',
    mobileLabel: 'Caja',
    icon: Wallet,
    slotAfter: '/admin/pos',
  },
];

function getHrefFromMenuNode(node) {
  if (!node) return '';
  const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
  return link?.getAttribute('href') || '';
}

function isMobileMenu(parent) {
  return parent?.classList?.contains('admin-mobile-nav-panel');
}

function getMenuSlot(parent, key) {
  if (!parent || !key) return null;

  let slot = parent.querySelector(`:scope > [data-admin-extra-menu-slot="${key}"]`);

  if (!slot) {
    slot = document.createElement('span');
    slot.setAttribute('data-admin-extra-menu-slot', key);
    slot.style.display = 'contents';
    parent.appendChild(slot);
  }

  return slot;
}

function orderMainMenu(parent) {
  if (!parent) return;

  const children = Array.from(parent.children);
  const menuNodes = new Map();

  children.forEach((child) => {
    const href = getHrefFromMenuNode(child);
    if (MAIN_MENU_ORDER.includes(href) && !menuNodes.has(href)) {
      menuNodes.set(href, child);
    }
  });

  const orderedNodes = MAIN_MENU_ORDER.map((href) => menuNodes.get(href)).filter(Boolean);
  const orderedSet = new Set(orderedNodes);
  const restNodes = children.filter((child) => !orderedSet.has(child));

  orderedNodes.forEach((node) => parent.appendChild(node));
  restNodes.forEach((node) => parent.appendChild(node));
}

function findMenuTargets(visibleLinks) {
  const anchorLinks = Array.from(document.querySelectorAll('a[href="/admin/ordenes"]'));
  const targets = [];
  const seen = new Set();

  anchorLinks.forEach((link) => {
    const parent = link.parentElement;
    if (!parent || seen.has(parent)) return;

    visibleLinks.forEach((menuLink) => {
      const existingLink = parent.querySelector(`a[href="${menuLink.path}"]`);
      if (existingLink && !existingLink.closest('[data-admin-extra-menu-slot]')) return;

      const slot = getMenuSlot(parent, menuLink.key);
      if (slot) {
        targets.push({ slot, mobile: isMobileMenu(parent), menuLink });
      }
    });

    orderMainMenu(parent);
    seen.add(parent);
  });

  return targets;
}

function AdminExtraMenuLink({ menuLink, mobile = false }) {
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

  const className = mobile
    ? 'inline-flex items-center admin-mobile-nav-item-gap admin-nav-padding-mobile rounded-[calc(var(--admin-radius)*0.55)] text-sm font-medium whitespace-nowrap transition-all duration-200 admin-nav-link-mobile'
    : 'group flex items-center admin-nav-item-gap admin-nav-padding rounded-[calc(var(--admin-radius)*0.55)] transition-all duration-200 text-sm font-medium admin-nav-link';

  const iconWrapStyle = mobile
    ? {
        width: 26,
        height: 26,
        borderRadius: 'calc(var(--admin-radius) * 0.38)',
      }
    : undefined;

  const Icon = menuLink.icon;

  return React.createElement(
    NavLink,
    {
      to: menuLink.path,
      className,
      style: ({ isActive }) => (isActive ? activeNavStyle : normalNavStyle),
    },
    React.createElement(
      'span',
      { className: 'admin-icon-wrap', style: iconWrapStyle },
      React.createElement(Icon, { className: mobile ? 'h-3 w-3' : 'h-3.5 w-3.5' })
    ),
    React.createElement('span', null, mobile ? menuLink.mobileLabel : menuLink.label)
  );
}

function AdminExtraMenuPortal() {
  const { adminUser } = useAuth();
  const location = useLocation();
  const [targets, setTargets] = useState([]);

  const visibleLinks = EXTRA_MAIN_LINKS.filter((menuLink) =>
    canAccessAdminPath(adminUser, menuLink.path)
  );

  useEffect(() => {
    if (visibleLinks.length === 0) {
      setTargets([]);
      return undefined;
    }

    let active = true;

    const refresh = () => {
      if (!active) return;
      setTargets(findMenuTargets(visibleLinks));
    };

    refresh();
    const interval = window.setInterval(refresh, 250);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [adminUser, location.pathname]);

  if (visibleLinks.length === 0 || targets.length === 0) return null;

  return targets.map(({ slot, mobile, menuLink }, index) =>
    createPortal(
      React.createElement(AdminExtraMenuLink, { menuLink, mobile }),
      slot,
      `admin-extra-menu-${menuLink.key}-${index}`
    )
  );
}

export default function AdminLayout() {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(OriginalAdminLayout),
    React.createElement(AdminExtraMenuPortal)
  );
}
