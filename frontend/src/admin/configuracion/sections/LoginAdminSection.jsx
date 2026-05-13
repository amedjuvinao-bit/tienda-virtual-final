// src/admin/configuracion/sections/LoginAdminSection.jsx
import React, { useMemo, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import {
  LOGIN_THEMES,
  LOGIN_LAYOUTS,
  DEFAULT_LOGIN_THEME_ID,
  DEFAULT_LOGIN_LAYOUT_ID,
} from '../../login/loginThemes';

const LOGIN_THEME_STORAGE_KEY = 'admin_login_theme_id';
const LOGIN_LAYOUT_STORAGE_KEY = 'admin_login_layout_id';

const LOGIN_BG_MODE_KEY = 'admin_login_bg_mode';
const LOGIN_BG_COLOR_KEY = 'admin_login_bg_color';
const LOGIN_BG_IMAGE_KEY = 'admin_login_bg_image';
const LOGIN_BG_IMAGE_OPACITY_KEY = 'admin_login_bg_image_opacity';
const LOGIN_BG_OVERLAY_KEY = 'admin_login_bg_overlay';

const DEFAULT_BG_MODE = 'theme';
const DEFAULT_BG_COLOR = '#fff7fb';
const DEFAULT_BG_IMAGE = '';
const DEFAULT_BG_IMAGE_OPACITY = '0.35';
const DEFAULT_BG_OVERLAY = '0.35';

function getStoredValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function dispatchLoginUpdate() {
  window.dispatchEvent(new Event('admin-login-theme-updated'));
}

export default function LoginAdminSection() {
  const [selectedTheme, setSelectedTheme] = useState(() =>
    getStoredValue(LOGIN_THEME_STORAGE_KEY, DEFAULT_LOGIN_THEME_ID)
  );

  const [selectedLayout, setSelectedLayout] = useState(() =>
    getStoredValue(LOGIN_LAYOUT_STORAGE_KEY, DEFAULT_LOGIN_LAYOUT_ID)
  );

  const [backgroundMode, setBackgroundMode] = useState(() =>
    getStoredValue(LOGIN_BG_MODE_KEY, DEFAULT_BG_MODE)
  );

  const [backgroundColor, setBackgroundColor] = useState(() =>
    getStoredValue(LOGIN_BG_COLOR_KEY, DEFAULT_BG_COLOR)
  );

  const [backgroundImage, setBackgroundImage] = useState(() =>
    getStoredValue(LOGIN_BG_IMAGE_KEY, DEFAULT_BG_IMAGE)
  );

  const [backgroundImageOpacity, setBackgroundImageOpacity] = useState(() =>
    getStoredValue(LOGIN_BG_IMAGE_OPACITY_KEY, DEFAULT_BG_IMAGE_OPACITY)
  );

  const [backgroundOverlay, setBackgroundOverlay] = useState(() =>
    getStoredValue(LOGIN_BG_OVERLAY_KEY, DEFAULT_BG_OVERLAY)
  );

  const themeOptions = useMemo(() => Object.values(LOGIN_THEMES), []);
  const layoutOptions = useMemo(() => Object.values(LOGIN_LAYOUTS), []);

  const activeTheme =
    LOGIN_THEMES[selectedTheme] || LOGIN_THEMES[DEFAULT_LOGIN_THEME_ID];

  const activeLayout =
    LOGIN_LAYOUTS[selectedLayout] || LOGIN_LAYOUTS[DEFAULT_LOGIN_LAYOUT_ID];

  const handleThemeChange = (e) => {
    const value = e.target.value || DEFAULT_LOGIN_THEME_ID;
    setSelectedTheme(value);
    saveStoredValue(LOGIN_THEME_STORAGE_KEY, value);
    dispatchLoginUpdate();
  };

  const handleLayoutChange = (e) => {
    const value = e.target.value || DEFAULT_LOGIN_LAYOUT_ID;
    setSelectedLayout(value);
    saveStoredValue(LOGIN_LAYOUT_STORAGE_KEY, value);
    dispatchLoginUpdate();
  };

  const handleBackgroundModeChange = (e) => {
    const value = e.target.value || DEFAULT_BG_MODE;
    setBackgroundMode(value);
    saveStoredValue(LOGIN_BG_MODE_KEY, value);
    dispatchLoginUpdate();
  };

  const handleBackgroundColorChange = (e) => {
    const value = e.target.value || DEFAULT_BG_COLOR;
    setBackgroundColor(value);
    saveStoredValue(LOGIN_BG_COLOR_KEY, value);
    dispatchLoginUpdate();
  };

  const handleBackgroundImageUrlChange = (e) => {
    const value = e.target.value || '';
    setBackgroundImage(value);
    saveStoredValue(LOGIN_BG_IMAGE_KEY, value);
    dispatchLoginUpdate();
  };

  const handleBackgroundImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      setBackgroundImage(result);
      saveStoredValue(LOGIN_BG_IMAGE_KEY, result);
      saveStoredValue(LOGIN_BG_MODE_KEY, 'image');
      setBackgroundMode('image');
      dispatchLoginUpdate();
    };

    reader.readAsDataURL(file);
  };

  const handleImageOpacityChange = (e) => {
    const value = e.target.value || DEFAULT_BG_IMAGE_OPACITY;
    setBackgroundImageOpacity(value);
    saveStoredValue(LOGIN_BG_IMAGE_OPACITY_KEY, value);
    dispatchLoginUpdate();
  };

  const handleOverlayChange = (e) => {
    const value = e.target.value || DEFAULT_BG_OVERLAY;
    setBackgroundOverlay(value);
    saveStoredValue(LOGIN_BG_OVERLAY_KEY, value);
    dispatchLoginUpdate();
  };

  const clearBackgroundImage = () => {
    setBackgroundImage('');
    saveStoredValue(LOGIN_BG_IMAGE_KEY, '');
    dispatchLoginUpdate();
  };

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Diseño del login admin"
        description="Aquí se define el estilo visual del login, controlado desde el panel administrativo."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Tema visual
            </span>

            <select
              value={selectedTheme}
              onChange={handleThemeChange}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              {themeOptions.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              {activeTheme?.description}
            </p>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Estilo de estructura
            </span>

            <select
              value={selectedLayout}
              onChange={handleLayoutChange}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              {layoutOptions.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              {activeLayout?.description}
            </p>
          </label>
        </div>

        <div className="mt-6 rounded-3xl border border-pink-100 bg-pink-50/40 p-5">
          <h3 className="text-base font-semibold text-gray-900">
            Fondo del login
          </h3>

          <p className="mt-1 text-sm text-gray-600">
            Elige si el fondo usará el degradado del tema, un color sólido o una foto personalizada.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Tipo de fondo
              </span>

              <select
                value={backgroundMode}
                onChange={handleBackgroundModeChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="theme">Degradado del tema</option>
                <option value="color">Color sólido</option>
                <option value="image">Foto de fondo</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Color sólido
              </span>

              <div className="flex gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={handleBackgroundColorChange}
                  className="h-11 w-14 rounded-xl border border-gray-300 bg-white p-1"
                />

                <input
                  type="text"
                  value={backgroundColor}
                  onChange={handleBackgroundColorChange}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                  placeholder="#fff7fb"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Opacidad de foto
              </span>

              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={backgroundImageOpacity}
                onChange={handleImageOpacityChange}
                className="w-full accent-pink-500"
              />

              <p className="mt-1 text-xs text-gray-500">
                Valor actual: {Math.round(Number(backgroundImageOpacity) * 100)}%
              </p>
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                URL de la foto
              </span>

              <input
                type="text"
                value={backgroundImage}
                onChange={handleBackgroundImageUrlChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="https://..."
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Subir foto desde el equipo
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={handleBackgroundImageFileChange}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Oscurecer/aclarar fondo
              </span>

              <input
                type="range"
                min="0"
                max="0.85"
                step="0.05"
                value={backgroundOverlay}
                onChange={handleOverlayChange}
                className="w-full accent-pink-500"
              />

              <p className="mt-1 text-xs text-gray-500">
                Capa de lectura: {Math.round(Number(backgroundOverlay) * 100)}%
              </p>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearBackgroundImage}
                className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm font-semibold text-pink-700 hover:bg-pink-50"
              >
                Quitar foto de fondo
              </button>
            </div>
          </div>
        </div>

        <div
          className="mt-5 overflow-hidden rounded-3xl border p-5"
          style={{
            background:
              backgroundMode === 'color'
                ? backgroundColor
                : backgroundMode === 'image' && backgroundImage
                  ? `linear-gradient(rgba(255,255,255,${backgroundOverlay}), rgba(255,255,255,${backgroundOverlay})), url("${backgroundImage}") center/cover no-repeat`
                  : activeTheme?.pageBg,
            borderColor: activeTheme?.cardBorder,
            boxShadow: activeTheme?.cardShadow,
          }}
        >
          <div className="flex flex-col gap-4 rounded-2xl bg-white/70 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: activeTheme?.titleColor }}
              >
                Vista previa de configuración
              </p>

              <p
                className="mt-1 text-xs"
                style={{ color: activeTheme?.mutedColor }}
              >
                Tema: {activeTheme?.name} · Estructura: {activeLayout?.name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                Fondo: {backgroundMode === 'theme' ? 'Degradado del tema' : backgroundMode === 'color' ? 'Color sólido' : 'Foto personalizada'}
              </p>
            </div>

            <div
              className="h-12 w-12 rounded-2xl"
              style={{
                background: activeTheme?.buttonBg,
                boxShadow: activeTheme?.buttonShadow,
              }}
            />
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title="Configuración aplicada"
        text="El login tomará este diseño automáticamente."
      />
    </div>
  );
}