// src/admin/configuracion/sections/PanelAdminSection.jsx
import React, { useEffect, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import api from '../../../lib/api';
import { applyAdminTheme, ADMIN_THEME_DEFAULT } from '../../theme/adminTheme';
import { applyAdminLayoutStyles } from '../../theme/adminLayoutStyles';

const ADMIN_THEME_PRESETS = {
  electricNeon: {
    preset: 'electricNeon',
    layout: {
      radius: 18,
      blur: 24,
      shadow: '0 20px 70px rgba(0,229,255,0.16)',
      sidebarWidth: 270,
      headerHeight: 76,
      density: 'comfortable',
    },
    primary: '#00e5ff',
    primaryHover: '#00b8d4',
    primarySoftBg: '#061826',
    primarySoftHover: '#0b2a3d',
    primarySoftBorder: '#00e5ff',
    primarySoftText: '#67e8f9',
    activeNavBg: '#083344',
    activeNavText: '#67e8f9',
    sidebarBg: '#020617',
    headerBg: '#07111f',
    pageBg: '#0f172a',
    cardBg: '#07111f',
    cardHeaderBg: '#061826',
    cardBorder: '#00e5ff',
    cardText: '#e0faff',
    cardMutedText: '#67e8f9',
    tableHeadBg: '#061826',
    tableBorder: '#0e7490',
    tableText: '#e0faff',
    tableMutedText: '#67e8f9',
    tableRowHover: '#0b2a3d',
    buttonBg: '#00e5ff',
    buttonHover: '#00b8d4',
    buttonText: '#020617',
    buttonSoftBg: '#061826',
    buttonSoftText: '#67e8f9',
    buttonSoftBorder: '#00e5ff',
    inputBg: '#020617',
    inputBorder: '#0e7490',
    inputText: '#e0faff',
    inputPlaceholder: '#67e8f9',
    inputFocus: '#00e5ff',
    modalBg: '#07111f',
    modalOverlay: 'rgba(0, 0, 0, 0.65)',
    danger: '#ff4d6d',
    dangerHover: '#ff1744',
    dangerSoftBg: '#2a0814',
    dangerText: '#ff8fa3',
    warning: '#facc15',
    warningSoftBg: '#2a2205',
    warningText: '#fde68a',
  },

  darkCyber: {
    preset: 'darkCyber',
    layout: {
      radius: 50,
      blur: 5,
      shadow: '0 5px 20px rgba(0,0,0,0.8)',
      sidebarWidth: 180,
      headerHeight: 64,
      density: 'compact',
    },
    primary: '#a855f7',
    primaryHover: '#9333ea',
    primarySoftBg: '#181026',
    primarySoftHover: '#2e1747',
    primarySoftBorder: '#7e22ce',
    primarySoftText: '#d8b4fe',
    activeNavBg: '#2e1065',
    activeNavText: '#f5d0fe',
    sidebarBg: '#09090b',
    headerBg: '#18181b',
    pageBg: '#030712',
    cardBg: '#111827',
    cardHeaderBg: '#181026',
    cardBorder: '#7e22ce',
    cardText: '#f9fafb',
    cardMutedText: '#d8b4fe',
    tableHeadBg: '#181026',
    tableBorder: '#4c1d95',
    tableText: '#f9fafb',
    tableMutedText: '#d8b4fe',
    tableRowHover: '#2e1747',
    buttonBg: '#a855f7',
    buttonHover: '#9333ea',
    buttonText: '#ffffff',
    buttonSoftBg: '#181026',
    buttonSoftText: '#d8b4fe',
    buttonSoftBorder: '#7e22ce',
    inputBg: '#09090b',
    inputBorder: '#4c1d95',
    inputText: '#f9fafb',
    inputPlaceholder: '#c084fc',
    inputFocus: '#a855f7',
    modalBg: '#111827',
    modalOverlay: 'rgba(0, 0, 0, 0.68)',
    danger: '#f43f5e',
    dangerHover: '#e11d48',
    dangerSoftBg: '#2a0f1c',
    dangerText: '#fda4af',
    warning: '#f59e0b',
    warningSoftBg: '#241806',
    warningText: '#fcd34d',
  },

  roseLuxuryLight: {
    preset: 'roseLuxuryLight',
    layout: {
      radius: 36,
      blur: 24,
      shadow: '0 24px 70px rgba(236,72,153,0.12)',
      sidebarWidth: 300,
      headerHeight: 82,
      density: 'spacious',
    },
    primary: '#ec4899',
    primaryHover: '#db2777',
    primarySoftBg: '#fdf2f8',
    primarySoftHover: '#fce7f3',
    primarySoftBorder: '#fbcfe8',
    primarySoftText: '#be185d',
    activeNavBg: '#fce7f3',
    activeNavText: '#be185d',
    sidebarBg: '#fff7fb',
    headerBg: '#ffffff',
    pageBg: '#fff1f7',
    cardBg: '#ffffff',
    cardHeaderBg: '#fdf2f8',
    cardBorder: '#fbcfe8',
    cardText: '#111827',
    cardMutedText: '#be185d',
    tableHeadBg: '#fdf2f8',
    tableBorder: '#fbcfe8',
    tableText: '#111827',
    tableMutedText: '#be185d',
    tableRowHover: '#fce7f3',
    buttonBg: '#ec4899',
    buttonHover: '#db2777',
    buttonText: '#ffffff',
    buttonSoftBg: '#fdf2f8',
    buttonSoftText: '#be185d',
    buttonSoftBorder: '#fbcfe8',
    inputBg: '#ffffff',
    inputBorder: '#fbcfe8',
    inputText: '#111827',
    inputPlaceholder: '#be185d',
    inputFocus: '#ec4899',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.4)',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    dangerSoftBg: '#fef2f2',
    dangerText: '#b91c1c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  goldBoutiqueLight: {
    preset: 'goldBoutiqueLight',
    layout: {
      radius: 28,
      blur: 18,
      shadow: '0 22px 65px rgba(212,175,55,0.16)',
      sidebarWidth: 286,
      headerHeight: 78,
      density: 'comfortable',
    },
    primary: '#d4af37',
    primaryHover: '#b88912',
    primarySoftBg: '#fffbeb',
    primarySoftHover: '#fef3c7',
    primarySoftBorder: '#fde68a',
    primarySoftText: '#92400e',
    activeNavBg: '#fef3c7',
    activeNavText: '#92400e',
    sidebarBg: '#fffdf5',
    headerBg: '#ffffff',
    pageBg: '#fffbeb',
    cardBg: '#ffffff',
    cardHeaderBg: '#fffbeb',
    cardBorder: '#fde68a',
    cardText: '#111827',
    cardMutedText: '#92400e',
    tableHeadBg: '#fffbeb',
    tableBorder: '#fde68a',
    tableText: '#111827',
    tableMutedText: '#92400e',
    tableRowHover: '#fef3c7',
    buttonBg: '#d4af37',
    buttonHover: '#b88912',
    buttonText: '#ffffff',
    buttonSoftBg: '#fffbeb',
    buttonSoftText: '#92400e',
    buttonSoftBorder: '#fde68a',
    inputBg: '#ffffff',
    inputBorder: '#fde68a',
    inputText: '#111827',
    inputPlaceholder: '#92400e',
    inputFocus: '#d4af37',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.38)',
    danger: '#b91c1c',
    dangerHover: '#991b1b',
    dangerSoftBg: '#fef2f2',
    dangerText: '#991b1b',
    warning: '#d4af37',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  glassPastel: {
    preset: 'glassPastel',
    layout: {
      radius: 34,
      blur: 32,
      shadow: '0 24px 80px rgba(251,113,133,0.14)',
      sidebarWidth: 290,
      headerHeight: 80,
      density: 'spacious',
    },
    primary: '#fb7185',
    primaryHover: '#f43f5e',
    primarySoftBg: '#fff1f2',
    primarySoftHover: '#ffe4e6',
    primarySoftBorder: '#fecdd3',
    primarySoftText: '#be123c',
    activeNavBg: '#ffe4e6',
    activeNavText: '#be123c',
    sidebarBg: '#fff7fb',
    headerBg: '#ffffff',
    pageBg: '#fdf2f8',
    cardBg: '#ffffff',
    cardHeaderBg: '#fff1f2',
    cardBorder: '#fecdd3',
    cardText: '#111827',
    cardMutedText: '#be123c',
    tableHeadBg: '#fff1f2',
    tableBorder: '#fecdd3',
    tableText: '#111827',
    tableMutedText: '#be123c',
    tableRowHover: '#ffe4e6',
    buttonBg: '#fb7185',
    buttonHover: '#f43f5e',
    buttonText: '#ffffff',
    buttonSoftBg: '#fff1f2',
    buttonSoftText: '#be123c',
    buttonSoftBorder: '#fecdd3',
    inputBg: '#ffffff',
    inputBorder: '#fecdd3',
    inputText: '#111827',
    inputPlaceholder: '#be123c',
    inputFocus: '#fb7185',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.36)',
    danger: '#f43f5e',
    dangerHover: '#e11d48',
    dangerSoftBg: '#fff1f2',
    dangerText: '#be123c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  pearlFuture: {
    preset: 'pearlFuture',
    layout: {
      radius: 22,
      blur: 20,
      shadow: '0 20px 60px rgba(100,116,139,0.14)',
      sidebarWidth: 270,
      headerHeight: 74,
      density: 'comfortable',
    },
    primary: '#64748b',
    primaryHover: '#475569',
    primarySoftBg: '#f8fafc',
    primarySoftHover: '#e2e8f0',
    primarySoftBorder: '#cbd5e1',
    primarySoftText: '#334155',
    activeNavBg: '#e2e8f0',
    activeNavText: '#334155',
    sidebarBg: '#ffffff',
    headerBg: '#f8fafc',
    pageBg: '#eef2ff',
    cardBg: '#ffffff',
    cardHeaderBg: '#f8fafc',
    cardBorder: '#cbd5e1',
    cardText: '#111827',
    cardMutedText: '#334155',
    tableHeadBg: '#f8fafc',
    tableBorder: '#cbd5e1',
    tableText: '#111827',
    tableMutedText: '#334155',
    tableRowHover: '#e2e8f0',
    buttonBg: '#64748b',
    buttonHover: '#475569',
    buttonText: '#ffffff',
    buttonSoftBg: '#f8fafc',
    buttonSoftText: '#334155',
    buttonSoftBorder: '#cbd5e1',
    inputBg: '#ffffff',
    inputBorder: '#cbd5e1',
    inputText: '#111827',
    inputPlaceholder: '#64748b',
    inputFocus: '#64748b',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(15, 23, 42, 0.36)',
    danger: '#dc2626',
    dangerHover: '#b91c1c',
    dangerSoftBg: '#fef2f2',
    dangerText: '#991b1b',
    warning: '#ca8a04',
    warningSoftBg: '#fefce8',
    warningText: '#854d0e',
  },

  neonRoseLight: {
    preset: 'neonRoseLight',
    layout: {
      radius: 42,
      blur: 26,
      shadow: '0 24px 80px rgba(255,45,149,0.18)',
      sidebarWidth: 300,
      headerHeight: 84,
      density: 'spacious',
    },
    primary: '#ff2d95',
    primaryHover: '#e60073',
    primarySoftBg: '#fff0f8',
    primarySoftHover: '#ffd6ec',
    primarySoftBorder: '#ff9bd2',
    primarySoftText: '#c2186a',
    activeNavBg: '#ffd6ec',
    activeNavText: '#c2186a',
    sidebarBg: '#fff5fb',
    headerBg: '#ffffff',
    pageBg: '#ffeaf5',
    cardBg: '#ffffff',
    cardHeaderBg: '#fff0f8',
    cardBorder: '#ff9bd2',
    cardText: '#111827',
    cardMutedText: '#c2186a',
    tableHeadBg: '#fff0f8',
    tableBorder: '#ff9bd2',
    tableText: '#111827',
    tableMutedText: '#c2186a',
    tableRowHover: '#ffd6ec',
    buttonBg: '#ff2d95',
    buttonHover: '#e60073',
    buttonText: '#ffffff',
    buttonSoftBg: '#fff0f8',
    buttonSoftText: '#c2186a',
    buttonSoftBorder: '#ff9bd2',
    inputBg: '#ffffff',
    inputBorder: '#ff9bd2',
    inputText: '#111827',
    inputPlaceholder: '#c2186a',
    inputFocus: '#ff2d95',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.38)',
    danger: '#ff2d55',
    dangerHover: '#e60033',
    dangerSoftBg: '#fff0f3',
    dangerText: '#c2183f',
    warning: '#f59e0b',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },

  minimalPro: {
    preset: 'minimalPro',
    layout: {
      radius: 12,
      blur: 8,
      shadow: '0 10px 30px rgba(17,24,39,0.08)',
      sidebarWidth: 245,
      headerHeight: 64,
      density: 'compact',
    },
    primary: '#111827',
    primaryHover: '#374151',
    primarySoftBg: '#f3f4f6',
    primarySoftHover: '#e5e7eb',
    primarySoftBorder: '#d1d5db',
    primarySoftText: '#111827',
    activeNavBg: '#e5e7eb',
    activeNavText: '#111827',
    sidebarBg: '#ffffff',
    headerBg: '#ffffff',
    pageBg: '#f3f4f6',
    cardBg: '#ffffff',
    cardHeaderBg: '#f9fafb',
    cardBorder: '#d1d5db',
    cardText: '#111827',
    cardMutedText: '#6b7280',
    tableHeadBg: '#f9fafb',
    tableBorder: '#d1d5db',
    tableText: '#111827',
    tableMutedText: '#6b7280',
    tableRowHover: '#f3f4f6',
    buttonBg: '#111827',
    buttonHover: '#374151',
    buttonText: '#ffffff',
    buttonSoftBg: '#f3f4f6',
    buttonSoftText: '#111827',
    buttonSoftBorder: '#d1d5db',
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    inputText: '#111827',
    inputPlaceholder: '#6b7280',
    inputFocus: '#111827',
    modalBg: '#ffffff',
    modalOverlay: 'rgba(0, 0, 0, 0.36)',
    danger: '#ef4444',
    dangerHover: '#dc2626',
    dangerSoftBg: '#fef2f2',
    dangerText: '#b91c1c',
    warning: '#d97706',
    warningSoftBg: '#fffbeb',
    warningText: '#92400e',
  },
};

function buildThemeWithSidebar(baseTheme, sidebarStyle) {
  const safeTheme = baseTheme || ADMIN_THEME_DEFAULT;
  const baseLayout = safeTheme.layout || {};

  if (sidebarStyle === 'compact') {
    return {
      ...safeTheme,
      layout: {
        ...baseLayout,
        sidebarWidth: 220,
        density: 'compact',
      },
    };
  }

  if (sidebarStyle === 'expanded') {
    return {
      ...safeTheme,
      layout: {
        ...baseLayout,
        sidebarWidth: 310,
        density: 'spacious',
      },
    };
  }

  return safeTheme;
}

export default function PanelAdminSection() {
  const [loading, setLoading] = useState(false);

  const [theme, setTheme] = useState('');
  const [sidebar, setSidebar] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        setLoading(true);
        const res = await api.get('/api/site-settings');

        const admin = res?.data?.admin || {};
        const savedTheme = admin?.theme || {};

        setTheme(savedTheme?.preset || '');
        setSidebar(admin?.sidebar || '');

        applyAdminTheme(savedTheme);
        applyAdminLayoutStyles(savedTheme);
      } catch (error) {
        console.error('❌ Error cargando configuración admin:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async (newData) => {
    try {
      await api.put('/api/site-settings', {
        admin: newData,
      });
    } catch (error) {
      console.error('❌ Error guardando configuración admin:', error);
    }
  };

  return (
    <div
      className="grid"
      style={{ gap: 'var(--admin-gap)' }}
    >
      <InfoCard
        variant="hero"
        title="Personalización del panel admin"
        description="Configura la apariencia interna del panel administrativo sin afectar la tienda pública."
      >
        <div
          className="relative overflow-hidden rounded-[calc(var(--admin-radius)*0.9)] border"
          style={{
            marginTop: 'calc(var(--admin-gap) * 0.9)',
            padding: 'calc(var(--admin-padding) * 1.05)',
            borderColor: 'var(--admin-glass-border)',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 64%, transparent), color-mix(in srgb, var(--admin-primary) 10%, transparent))',
            boxShadow:
              '0 18px 48px color-mix(in srgb, var(--admin-primary) 12%, transparent), inset 0 1px 0 var(--admin-glass-highlight)',
            backdropFilter: 'blur(22px) saturate(1.35)',
            WebkitBackdropFilter: 'blur(22px) saturate(1.35)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 14% 20%, color-mix(in srgb, var(--admin-primary) 18%, transparent), transparent 34%), radial-gradient(circle at 86% 12%, rgba(255,255,255,0.22), transparent 32%)',
              opacity: 0.72,
              pointerEvents: 'none',
            }}
          />

          <div
            className="relative z-10 mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: 'var(--admin-primary)' }}
              >
                Apariencia interna
              </p>
              <h3
                className="mt-1 text-lg font-semibold"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Ajustes visuales del panel
              </h3>
            </div>

            <div
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: 'var(--admin-primary-soft-border)',
                background: 'var(--admin-primary-soft-bg)',
                color: 'var(--admin-primary-soft-text)',
              }}
            >
              Cambios en tiempo real
            </div>
          </div>

          <div
            className="relative z-10 grid md:grid-cols-2"
            style={{ gap: 'var(--admin-gap)' }}
          >
            <label className="block">
              <span
                className="mb-1 block text-sm font-medium"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Tema del panel
              </span>
              <select
                value={theme}
                disabled={loading}
                onChange={(e) => {
                  const value = e.target.value;
                  const selectedTheme =
                    ADMIN_THEME_PRESETS[value] || ADMIN_THEME_DEFAULT;

                  const finalTheme = buildThemeWithSidebar(selectedTheme, sidebar);

                  setTheme(value);
                  applyAdminTheme(finalTheme);
                  applyAdminLayoutStyles(finalTheme);

                  handleSave({
                    theme: finalTheme,
                    sidebar,
                  });
                }}
                className="w-full outline-none transition-all"
                style={{
                  borderRadius: 'calc(var(--admin-radius) * 0.55)',
                  border: '1px solid var(--admin-input-border)',
                  background: 'var(--admin-input-bg)',
                  color: 'var(--admin-input-text)',
                  padding: 'calc(var(--admin-padding) * 0.55) calc(var(--admin-padding) * 0.75)',
                }}
              >
                <option value="">Selecciona un tema</option>
                <option value="electricNeon">Neón eléctrico</option>
                <option value="darkCyber">Oscuro cyber</option>
                <option value="roseLuxuryLight">Rosa luxury claro</option>
                <option value="goldBoutiqueLight">Dorado boutique claro</option>
                <option value="glassPastel">Glass pastel</option>
                <option value="pearlFuture">Perla futurista</option>
                <option value="neonRoseLight">Rosa neón claro</option>
                <option value="minimalPro">Minimal pro claro</option>
              </select>
            </label>

            <label className="block">
              <span
                className="mb-1 block text-sm font-medium"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Estilo del sidebar
              </span>
              <select
                value={sidebar}
                disabled={loading}
                onChange={(e) => {
                  const value = e.target.value;
                  const selectedTheme =
                    ADMIN_THEME_PRESETS[theme] || ADMIN_THEME_DEFAULT;

                  const finalTheme = buildThemeWithSidebar(selectedTheme, value);

                  setSidebar(value);
                  applyAdminTheme(finalTheme);
                  applyAdminLayoutStyles(finalTheme);

                  handleSave({
                    theme: finalTheme,
                    sidebar: value,
                  });
                }}
                className="w-full outline-none transition-all"
                style={{
                  borderRadius: 'calc(var(--admin-radius) * 0.55)',
                  border: '1px solid var(--admin-input-border)',
                  background: 'var(--admin-input-bg)',
                  color: 'var(--admin-input-text)',
                  padding: 'calc(var(--admin-padding) * 0.55) calc(var(--admin-padding) * 0.75)',
                }}
              >
                <option value="">Selecciona estilo</option>
                <option value="compact">Compacto</option>
                <option value="expanded">Expandido</option>
              </select>
            </label>
          </div>
        </div>
      </InfoCard>

      <div
        className="relative overflow-hidden rounded-[calc(var(--admin-radius)*0.85)] border"
        style={{
          borderColor: 'var(--admin-glass-border)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 10%, transparent), color-mix(in srgb, var(--admin-card-bg) 58%, transparent))',
          boxShadow:
            '0 14px 34px color-mix(in srgb, var(--admin-primary) 10%, transparent), inset 0 1px 0 var(--admin-glass-highlight)',
          backdropFilter: 'blur(18px) saturate(1.25)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.25)',
        }}
      >
        <EmptyHint
          title="Configuración aplicada"
          text="El panel tomará esta apariencia automáticamente desde la base de datos. Para que las tablas, cards, botones e inputs internos cambien de color."
        />
      </div>
    </div>
  );
}