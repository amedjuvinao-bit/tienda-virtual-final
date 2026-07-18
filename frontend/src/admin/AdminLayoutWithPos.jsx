// frontend/src/admin/AdminLayoutWithPos.jsx

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OriginalAdminLayout from './AdminLayout.jsx';
import { canAccessAdminPath } from './security/adminPermissions';

const MAIN_MENU_ORDER = [
  '/admin/dashboard',
  '/admin/productos',
  '/admin/ordenes',
  '/admin/pos',
  '/admin/inventario',
  '/admin/carritos',
  '/admin/favoritos',
];

function getHrefFromMenuNode(node) {
  if (!node) return '';

  const link = node.matches?.('a[href]') ? node : node.querySelector?.('a[href]');
  return link?.getAttribute('href') || '';
}

function isMobileMenu(parent) {
  return parent?.classList?.contains('admin-mobile-nav-panel');
}

function getPosSlot(parent) {
  if (!parent) return null;

  let slot = parent.querySelector(':scope > [data-admin-pos-menu-slot="true"]');

  if (!slot) {
    slot = document.createElement('span');
    slot.setAttribute('data-admin-pos-menu-slot', 'true');
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

  const orderedNodes = MAIN_MENU_ORDER
    .map((href) => menuNodes.get(href))
    .filter(Boolean);

  const orderedSet = new Set(orderedNodes);
  const restNodes = children.filter((child) => !orderedSet.has(child));

  orderedNodes.forEach((node) => parent.appendChild(node));
  restNodes.forEach((node) => parent.appendChild(node));
}

function findPosMenuSlots() {
  const orderLinks = Array.from(document.querySelectorAll('a[href="/admin/ordenes"]'));
  const parents = [];
  const seen = new Set();

  orderLinks.forEach((link) => {
    const parent = link.parentElement;
    if (!parent || seen.has(parent)) return;

    const slot = getPosSlot(parent);
    orderMainMenu(parent);

    parents.push({ parent, slot, mobile: isMobileMenu(parent) });
    seen.add(parent);
  });

  return parents;
}

function PosMenuLink({ mobile = false }) {
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

  return (
    <NavLink
      to="/admin/pos"
      className={className}
      style={({ isActive }) => (isActive ? activeNavStyle : normalNavStyle)}
    >
      <span
        className="admin-icon-wrap"
        style={
          mobile
            ? {
                width: 26,
                height: 26,
                borderRadius: 'calc(var(--admin-radius) * 0.38)',
              }
            : undefined
        }
      >
        <Store className={mobile ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      </span>
      <span>{mobile ? 'POS' : 'POS / Ventas físicas'}</span>
    </NavLink>
  );
}

function PosMenuPortal() {
  const { adminUser } = useAuth();
  const location = useLocation();
  const [targets, setTargets] = useState([]);

  const canSeePos = canAccessAdminPath(adminUser, '/admin/pos');

  useEffect(() => {
    if (!canSeePos) {
      setTargets([]);
      return undefined;
    }

    let active = true;

    const refresh = () => {
      if (!active) return;
      setTargets(findPosMenuSlots());
    };

    refresh();
    const interval = window.setInterval(refresh, 250);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 2500);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [canSeePos, location.pathname]);

  if (!canSeePos || targets.length === 0) return null;

  return targets.map(({ slot, mobile }, index) =>
    createPortal(<PosMenuLink mobile={mobile} />, slot, `admin-pos-menu-${index}`)
  );
}

export default function AdminLayoutWithPos() {
  return (
    <>
      <OriginalAdminLayout />
      <PosMenuPortal />
    </>
  );
}
