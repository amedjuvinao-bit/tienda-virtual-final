import { useRef } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';

export default function OrderDetailTabs({ tabs, activeTab, onChange }) {
  const tabRefs = useRef([]);

  const moveFocus = (currentIndex, direction) => {
    if (!tabs.length) return;
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <nav
      aria-label="Secciones del detalle de la orden"
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 18,
        background: ORDER_DETAIL_THEME.cardBg,
        boxShadow: '0 12px 34px rgba(15, 23, 42, 0.07)',
        padding: 6,
        overflowX: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <div
        role="tablist"
        aria-label="Contenido de la orden"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 5,
          minWidth: 'max-content',
        }}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`order-detail-tab-${tab.id}`}
              aria-controls="order-detail-active-panel"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  moveFocus(index, 1);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  moveFocus(index, -1);
                } else if (event.key === 'Home') {
                  event.preventDefault();
                  onChange(tabs[0].id);
                  tabRefs.current[0]?.focus();
                } else if (event.key === 'End') {
                  event.preventDefault();
                  onChange(tabs[tabs.length - 1].id);
                  tabRefs.current[tabs.length - 1]?.focus();
                }
              }}
              style={{
                minHeight: 40,
                border: active
                  ? `1px solid ${ORDER_DETAIL_THEME.cardBorder}`
                  : '1px solid transparent',
                borderRadius: 12,
                background: active
                  ? ORDER_DETAIL_THEME.primarySoftBg
                  : 'transparent',
                color: active
                  ? ORDER_DETAIL_THEME.primary
                  : ORDER_DETAIL_THEME.mutedText,
                padding: '0 14px',
                fontSize: 11,
                fontWeight: active ? 950 : 800,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: active
                  ? 'inset 0 1px 0 rgba(255,255,255,0.7)'
                  : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
