import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Search, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
}

function isCurrentPath(pathname, target) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function AdminMobileNavigation({ primaryLinks = [], groups = [] }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const closeButtonRef = useRef(null);
  const searchInputRef = useRef(null);
  const triggerRef = useRef(null);

  const normalizedQuery = normalizeSearch(query);
  const visibleGroups = useMemo(
    () => groups
      .map((group) => ({
        ...group,
        links: group.links.filter((item) => (
          !normalizedQuery || normalizeSearch(`${item.label} ${group.label}`).includes(normalizedQuery)
        )),
      }))
      .filter((group) => group.links.length > 0),
    [groups, normalizedQuery],
  );

  const moreIsActive = !primaryLinks.some((item) => isCurrentPath(location.pathname, item.to));

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [location.pathname]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (window.matchMedia('(max-width: 767px)').matches && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const sheet = document.getElementById('admin-mobile-more-sheet');
      const focusable = Array.from(sheet?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled])',
      ) || []);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="admin-mobile-navigation md:hidden">
      {open ? (
        <div className="admin-mobile-more-layer">
          <button
            type="button"
            className="admin-mobile-more-backdrop"
            aria-label="Cerrar menú de módulos"
            onClick={() => setOpen(false)}
          />
          <section
            id="admin-mobile-more-sheet"
            className="admin-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-mobile-more-title"
          >
            <div className="admin-mobile-more-handle" aria-hidden="true" />
            <header className="admin-mobile-more-header">
              <div>
                <h2 id="admin-mobile-more-title">Módulos del panel</h2>
                <p>Abre únicamente la herramienta que necesitas.</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="admin-mobile-more-close"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
              >
                <X aria-hidden="true" />
              </button>
            </header>

            <label className="admin-mobile-more-search">
              <Search aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar un módulo"
                aria-label="Buscar un módulo del panel"
              />
            </label>

            <div className="admin-mobile-more-groups">
              {visibleGroups.length > 0 ? visibleGroups.map((group) => (
                <section key={group.label} className="admin-mobile-more-group">
                  <h3>{group.label}</h3>
                  <div className="admin-mobile-more-grid">
                    {group.links.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className="admin-mobile-more-link"
                          data-active={isCurrentPath(location.pathname, item.to) ? 'true' : 'false'}
                        >
                          <span><Icon aria-hidden="true" /></span>
                          <strong>{item.label}</strong>
                        </NavLink>
                      );
                    })}
                  </div>
                </section>
              )) : (
                <p className="admin-mobile-more-empty">No encontramos un módulo con ese nombre.</p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <nav className="admin-mobile-bottom-nav" aria-label="Navegación móvil principal">
        {primaryLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="admin-mobile-bottom-link"
              data-active={isCurrentPath(location.pathname, item.to) ? 'true' : 'false'}
              aria-label={item.mobileLabel || item.label}
              title={item.mobileLabel || item.label}
            >
              <Icon aria-hidden="true" />
            </NavLink>
          );
        })}
        <button
          ref={triggerRef}
          type="button"
          className="admin-mobile-bottom-link"
          data-active={moreIsActive || open ? 'true' : 'false'}
          aria-expanded={open}
          aria-controls="admin-mobile-more-sheet"
          aria-label="Más módulos"
          title="Más módulos"
          onClick={() => setOpen(true)}
        >
          <MoreHorizontal aria-hidden="true" />
        </button>
      </nav>
    </div>,
    document.body,
  );
}
