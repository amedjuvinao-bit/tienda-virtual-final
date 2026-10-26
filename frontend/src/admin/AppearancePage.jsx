import { pagePublicPath, pageMeta } from "./pages/workspace/pageModel";
import api, { adminFetch } from "../lib/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, Image, LayoutTemplate, Palette, RotateCcw, Rows3, Save, Type } from "lucide-react";
import { fetchAppearanceSettings, fetchSiteSettings, saveSiteSettings } from "../lib/siteSettingsApi";
import { applyTheme } from "../theme/applyTheme";
import PremiumAdminNavIcon from "./components/PremiumAdminNavIcon";
import GeneralPanel from "./appearance/general/GeneralPanel";
import HeaderPanel from "./appearance/header/HeaderPanel";
import { validateAppearanceDraft } from "./appearance/appearanceValidation";
import { verifyAppearanceSave } from "./appearance/verifyAppearanceSave";
import { API_BASE_URL } from "../config/apiBaseUrl";
import BannerPanel from "./appearance/banner/BannerPanel";
import SectionsPanel from "./appearance/sections/SectionsPanel";
import FooterPanel from "./appearance/footer/FooterPanel";
import useAdminPermissions from "./security/useAdminPermissions";
import AdminLoadingScreen from "./loading/AdminLoadingScreen";
import { getRememberedAdminLoader } from "./loading/adminLoaderConfig";
import { buildThemeFromServer, buildMenusFromServer, normalizeThemeForSave, getValueAtPath, deepEqual } from "./appearance/appearanceModel";
import './appearance/appearanceWorkspace.css';

const API_BASE = API_BASE_URL;

const RB_SETTINGS_TICK_KEY = "rb_site_settings_tick";

export default function AppearancePage() {
  const { can } = useAdminPermissions();
  const canEditAppearance = can('appearance:update');
  const canEditSections = can('appearance:sections');
  const canEditMenus = can('appearance:menus');
  const canEditAny = canEditAppearance || canEditSections || canEditMenus;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [serverSnapshot, setServerSnapshot] = useState(null);
  const [storeIdentity, setStoreIdentity] = useState({});
  const [appearanceRevision, setAppearanceRevision] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveConflict, setSaveConflict] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const savingRef = useRef(false);

  const [activeTab, setActiveTab] = useState("general");
  const [theme, setTheme] = useState(buildThemeFromServer(null));

  // ✅ Menú editable (Header)
  const [menus, setMenus] = useState(buildMenusFromServer(null));
  const [menusSnapshot, setMenusSnapshot] = useState(buildMenusFromServer(null));

  const normalizedSnapshot = useMemo(() => serverSnapshot ? normalizeThemeForSave(serverSnapshot) : null, [serverSnapshot]);
  const changedAreas = useMemo(() => {
    if (!serverSnapshot) return [];
    const current = normalizeThemeForSave(theme);
    const original = normalizedSnapshot;
    const changed = new Set();
    for (const key of Object.keys(current)) {
      if (!deepEqual(current[key], original[key])) {
        changed.add(['header', 'banner', 'sections', 'footer'].includes(key) ? key : 'general');
      }
    }
    if (!deepEqual(menus.header, menusSnapshot.header)) changed.add('header');
    if (!deepEqual(menus.footer, menusSnapshot.footer)) changed.add('footer');
    return [...changed];
  }, [theme, serverSnapshot, normalizedSnapshot, menus, menusSnapshot]);

  useEffect(() => {
    if (changedAreas.length && ['success', 'info'].includes(saveMessage?.type)) setSaveMessage(null);
  }, [changedAreas.length, saveMessage]);

  useEffect(() => {
    if (!saveMessage || saveMessage.type === 'error') return undefined;
    const timeout = window.setTimeout(() => setSaveMessage((current) => current === saveMessage ? null : current), 6000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  useEffect(() => {
    if (!changedAreas.length) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changedAreas.length]);

  const [uploading, setUploading] = useState(false);

  // ✅ Páginas dinámicas para rutas del Header
  const [dynamicPages, setDynamicPages] = useState([]);

  // ✅ Rutas reales (según tu App.jsx) + páginas dinámicas
  const routeOptions = useMemo(
    () => ({
      public: [
        { label: "Inicio", value: "/" },
        { label: "Lo Nuevo", value: "/#tendencia" },
        { label: "Carrito", value: "/carrito" },
        { label: "Favoritos", value: "/favoritos" },

        ...dynamicPages.filter(page => !pageMeta(page).requiresOrder && page.pageType !== "product-detail" && page.enabled !== false).map((page) => ({
          label: `Página · ${page.name}`,
          value: pagePublicPath(page),
        })),
      ],
    }),
    [dynamicPages]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const settings = await fetchAppearanceSettings();
        if (!settings?.theme || !settings?.menus ||
          !Number.isSafeInteger(settings.appearanceRevision) || settings.appearanceRevision < 0) {
          throw new Error("La configuración de apariencia llegó incompleta.");
        }
        if (cancelled) return;
        const merged = buildThemeFromServer(settings?.theme);
        setTheme(merged);
        setStoreIdentity(settings.store || {});
        setServerSnapshot(merged);
        setAppearanceRevision(settings.appearanceRevision);
        setSaveConflict(false);
        setSaveMessage(null);
        applyTheme(merged);

        const mergedMenus = buildMenusFromServer(settings?.menus);
        setMenus(mergedMenus);
        setMenusSnapshot(mergedMenus);
      } catch (error) {
        if (!cancelled) {
          console.error("No se pudo cargar Apariencia:", error);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch(`${API_BASE}/api/pages`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const safePages = Array.isArray(data)
          ? data
              .filter((page) => page && page.enabled !== false)
              .map((page) => ({
                _id: String(page?._id || "").trim(),
                name: String(page?.name || "").trim(),
                slug: String(page?.slug || "").trim(),
              }))
              .filter((page) => page.name && page.slug)
          : [];

        setDynamicPages(safePages);
      } catch (error) {
        console.error("❌ Error cargando páginas dinámicas para Header:", error);
        setDynamicPages([]);
      }
    })();
  }, []);

  // ✅ FIX CLAVE:
  // 1) useCallback => referencia estable para que SectionsPanel no dispare effects por identidad nueva
  // 2) no-op si el valor realmente no cambió => evita rerenders del padre innecesarios
  const setPath = useCallback((path, value) => {
    setTheme((prev) => {
      const currentValue = getValueAtPath(prev, path);
      const nextValue = typeof value === 'function' ? value(currentValue, prev) : value;
      if (deepEqual(currentValue, nextValue)) {
        return prev;
      }

      const keys = String(path || "").split(".");
      const draft = { ...prev };
      let ref = draft;
      let original = prev;
      for (const key of keys.slice(0, -1)) {
        const branch = original?.[key];
        ref[key] = Array.isArray(branch) ? [...branch] : { ...branch };
        ref = ref[key];
        original = branch;
      }
      ref[keys.at(-1)] = nextValue;
      return draft;
    });
  }, []);

  const onPreview = () => {
    applyTheme(theme);
    if (!changedAreas.length) setSaveMessage({ type: 'info', text: 'La vista previa ya muestra la configuración guardada.' });
  };

  const onReset = () => {
    if (savingRef.current || saveConflict) return;
    if (!changedAreas.length) {
      setSaveMessage({ type: 'info', text: 'No hay cambios por descartar.' });
      return;
    }
    if (serverSnapshot) {
      const merged = buildThemeFromServer(serverSnapshot);
      setTheme(merged);
      applyTheme(merged);
    }
    if (menusSnapshot) {
      const mm = buildMenusFromServer(menusSnapshot);
      setMenus(mm);
    }
    setSaveMessage(null);
  };

  // ✅ Helpers del menú header
  const setHeaderMenuItem = (index, patch) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      if (!draft.header[index]) return draft;
      draft.header[index] = { ...draft.header[index], ...patch };
      return draft;
    });
  };

  const addHeaderMenuItem = () => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      draft.header.push({
        title: "Nuevo botón",
        type: "url",
        ref: "/",
        icon: "grid",
        children: [],
      });
      return draft;
    });
  };

  const removeHeaderMenuItem = (index) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      draft.header.splice(index, 1);
      return draft;
    });
  };

  const moveHeaderMenuItem = (from, to) => {
    setMenus((prev) => {
      const draft = structuredClone(prev);
      if (!Array.isArray(draft.header)) draft.header = [];
      if (to < 0 || to >= draft.header.length) return draft;
      const item = draft.header.splice(from, 1)[0];
      draft.header.splice(to, 0, item);
      return draft;
    });
  };

  // ✅ Subir archivo a Cloudinary usando tu backend (campo por defecto: "image")
  const uploadToCloudinaryViaBackend = async (file, fieldName = "image") => {
    const form = new FormData();
    form.append(fieldName, file);

    let data;
    try {
      ({ data } = await api.post('/api/uploads', form));
    } catch (error) {
      throw new Error(error?.userMessage || error?.response?.data?.message || error?.response?.data?.error || 'No se pudo subir la imagen. Inténtalo de nuevo.');
    }

    if (!data?.url) throw new Error("El backend no devolvió { url }");
    return data.url;
  };

  const onSave = async () => {
    if (savingRef.current || saveConflict || serverSnapshot === null || appearanceRevision === null || uploading) return;
    savingRef.current = true;
    setSaving(true);
    setSaveConflict(false);
    setSaveMessage(null);
    const showValidation = (message) => setSaveMessage({ type: 'error', text: message });
    try {
      const normalizedTheme = normalizeThemeForSave(theme);
      const originalTheme = normalizeThemeForSave(serverSnapshot);
      const changedTheme = {};
      for (const key of Object.keys(normalizedTheme)) {
        if (!deepEqual(normalizedTheme[key], originalTheme[key])) {
          changedTheme[key] = normalizedTheme[key];
        }
      }

      const changedMenus = {};
      if (!deepEqual(menus.header, menusSnapshot.header)) {
        changedMenus.header = (menus.header || []).map((it) => ({
          ...it,
          title: String(it?.title || '').trim(),
          type: String(it?.type || 'url').trim(),
          ref: String(it?.ref || '').trim(),
          children: Array.isArray(it?.children) ? it.children : [],
        }));
      }
      if (!deepEqual(menus.footer, menusSnapshot.footer)) changedMenus.footer = menus.footer;

      const payload = { appearanceRevision };
      if (Object.keys(changedTheme).length) payload.theme = changedTheme;
      if (Object.keys(changedMenus).length) payload.menus = changedMenus;
      if (!payload.theme && !payload.menus) {
        setSaveMessage({ type: 'info', text: 'No hay cambios por guardar.' });
        return;
      }

      const validationError = validateAppearanceDraft({ theme, changedTheme, changedMenus });
      if (validationError) { showValidation(validationError); return; }

      const saved = await saveSiteSettings(payload);
      await verifyAppearanceSave({ saved, changedTheme, normalizedTheme, originalTheme, fetchPublicSettings: () => fetchSiteSettings() });

      const merged = buildThemeFromServer(saved?.theme || theme);
      setServerSnapshot(merged);
      setAppearanceRevision(saved.appearanceRevision);
      setTheme(merged);
      applyTheme(merged);

      const mergedMenus = buildMenusFromServer(saved?.menus || menus);
      setMenus(mergedMenus);
      setMenusSnapshot(mergedMenus);

      // ✅ avisar al banner (CarouselBanner.jsx) que recargue settings
      try {
        localStorage.setItem(RB_SETTINGS_TICK_KEY, String(Date.now()));
        window.dispatchEvent(new Event("rb_site_settings_updated"));
      } catch (_) {}

      setSaveMessage({ type: 'success', text: 'Cambios guardados. La tienda pública ya usa esta configuración.' });
    } catch (err) {
      console.error("❌ Error guardando apariencia:", err);
      if (Number.isSafeInteger(err.appearanceRevision)) setAppearanceRevision(err.appearanceRevision);
      if (err.appearanceSnapshot) setServerSnapshot(buildThemeFromServer(err.appearanceSnapshot));
      if (['APPEARANCE_REVISION_CONFLICT', 'APPEARANCE_REVISION_REQUIRED'].includes(err?.response?.data?.error)) {
        setSaveConflict(true);
      } else {
        setSaveMessage({ type: 'error', text: err.userMessage || err.message || 'Error al guardar apariencia.' });
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <AdminLoadingScreen compact model={getRememberedAdminLoader()} message="Cargando Apariencia…" />;
  if (loadError) {
    return (
      <div className="admin-widget-surface mx-auto max-w-xl rounded-2xl p-6" role="alert">
        <h1 className="text-xl font-semibold">No se pudo cargar Apariencia</h1>
        <p className="mt-2 text-sm">La configuración guardada no está disponible. Vuelve a intentar para editarla sin perder el diseño vigente.</p>
        <button type="button" className="mt-4 rounded-xl px-4 py-2 font-semibold" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Reintentar carga
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "General", detail: "Herramientas y animación", icon: Palette, help: "Configura la animación global, WhatsApp, navegación y pantalla de carga." },
    { id: "header", label: "Encabezado", detail: "Logo y menú", icon: LayoutTemplate, help: "Configura el logo y los enlaces del menú." },
    { id: "banner", label: "Portada", detail: "Imagen o video", icon: Image, help: "Configura la primera imagen o video que ve el cliente." },
    { id: "sections", label: "Secciones", detail: "Página de inicio", icon: Rows3, help: "Organiza el contenido debajo de la portada." },
    { id: "footer", label: "Pie de página", detail: "Datos y enlaces", icon: Type, help: "Configura la información del final de la tienda." },
  ];
  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const canEditCurrentArea = activeTab === 'sections'
    ? canEditSections
    : activeTab === 'header'
      ? canEditAppearance || canEditMenus
      : canEditAppearance;

  return (
    <div className="appearance-workspace mx-auto max-w-6xl p-4 md:p-6">
      {saveConflict && (
        <div className="admin-widget-surface rounded-2xl p-4" role="alert">
          <p>La Apariencia guardada cambió mientras editabas. Tus cambios siguen en este panel; no se sobrescribió la versión guardada.</p>
          <button type="button" className="mt-3 rounded-xl border px-4 py-2" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Cargar versión actual y descartar mis cambios
          </button>
        </div>
      )}
      <header className="appearance-workspace__header">
        <div className="appearance-workspace__intro">
          <h1>Apariencia de la tienda</h1>
          <p>
            {changedAreas.length > 0 && <span className="appearance-workspace__pending" title={`Pendiente: ${tabs.filter((tab) => changedAreas.includes(tab.id)).map((tab) => tab.label).join(', ')}.`}>{changedAreas.length} {changedAreas.length === 1 ? 'área pendiente' : 'áreas pendientes'} por guardar</span>}
            <span className="appearance-workspace__help">{canEditCurrentArea ? currentTab.help : 'Solo lectura para tu perfil.'}</span>
          </p>
        </div>
        <nav className="appearance-navigation" aria-label="Áreas de apariencia">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="appearance-navigation__item"
                data-active={selected}
                aria-pressed={selected}
                aria-label={`${tab.label} ${tab.detail}`}
                title={`${tab.label}: ${tab.detail}`}
                type="button"
              >
                <TabIcon size={18} aria-hidden="true" />
                <span>
                  <strong>{tab.label}</strong>
                  <small>{tab.detail}</small>
                </span>
                {changedAreas.includes(tab.id) && <span className="appearance-navigation__pending" aria-label="Cambios sin guardar" title="Cambios sin guardar" />}
              </button>
            );
          })}
        </nav>
      </header>
      {saveMessage && createPortal(
        <div className="appearance-feedback" data-feedback={saveMessage.type} role={saveMessage.type === 'error' ? 'alert' : 'status'} aria-live={saveMessage.type === 'error' ? 'assertive' : 'polite'}>
          <span className="appearance-feedback__indicator" aria-hidden="true" />
          <div><strong>{saveMessage.type === 'success' ? 'Cambios guardados' : saveMessage.type === 'error' ? 'Revisa los cambios' : 'Estado de Apariencia'}</strong><p>{saveMessage.text}</p></div>
          <button type="button" onClick={() => setSaveMessage(null)} aria-label="Cerrar aviso" title="Cerrar aviso">×</button>
        </div>, document.body
      )}
      {createPortal(
        <div className="appearance-action-dock" role="group" aria-label="Acciones de apariencia">
          <button onClick={onPreview} disabled={saving} className="appearance-action appearance-action--secondary" type="button" aria-label="Aplicar aquí" data-tooltip="Aplicar aquí"><PremiumAdminNavIcon icon={Eye} compact /></button>
          <button onClick={onReset} disabled={saving || saveConflict} className="appearance-action appearance-action--secondary" type="button" aria-label="Descartar cambios" data-tooltip="Descartar cambios"><PremiumAdminNavIcon icon={RotateCcw} compact /></button>
          <button onClick={onSave} disabled={saving || uploading || saveConflict || !canEditAny} className="appearance-action appearance-action--primary" type="button" aria-label={saving ? 'Guardando…' : 'Guardar cambios'} data-tooltip={saving ? 'Guardando…' : 'Guardar cambios'}><PremiumAdminNavIcon icon={Save} compact /></button>
        </div>, document.body
      )}

      {/* Contenido */}
      <main className="appearance-workspace__editor min-w-0">
        <fieldset disabled={saving} className="min-w-0">
        <div className="min-w-0">
          {/* GENERAL */}
          {activeTab === "general" && <fieldset disabled={!canEditAppearance}><GeneralPanel
            theme={theme} setPath={setPath} uploading={uploading} setUploading={setUploading}
            savedRevision={appearanceRevision}
            uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
          /></fieldset>}

          {/* HEADER */}
          {activeTab === "header" && (
            <HeaderPanel
              theme={theme}
              store={storeIdentity}
              setPath={setPath}
              menus={menus}
              routeOptions={routeOptions}
              uploading={uploading}
              setUploading={setUploading}
              savedRevision={appearanceRevision}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
              addHeaderMenuItem={addHeaderMenuItem}
              removeHeaderMenuItem={removeHeaderMenuItem}
              moveHeaderMenuItem={moveHeaderMenuItem}
              setHeaderMenuItem={setHeaderMenuItem}
              canEditTheme={canEditAppearance}
              canEditMenus={canEditMenus}
            />
          )}

          {/* ✅ BANNER */}
          {activeTab === "banner" && (
            <fieldset disabled={!canEditAppearance}>
            <BannerPanel
              theme={theme}
              store={storeIdentity}
              setPath={setPath}
              disabled={saving || !canEditAppearance}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
            />
            </fieldset>
          )}

          {/* ✅ SECCIONES (reemplaza Home/Body) */}
          {activeTab === "sections" && (
            <fieldset disabled={!canEditSections}>
            <SectionsPanel
              theme={theme}
              setPath={setPath}
              disabled={saving || !canEditSections}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinary={uploadToCloudinaryViaBackend}
            />
            </fieldset>
          )}

          {/* ✅ FOOTER separado */}
          {activeTab === "footer" && (
            <fieldset disabled={!canEditAppearance}>
            <FooterPanel
              store={storeIdentity}
              theme={theme}
              setPath={setPath}
              uploading={uploading}
              setUploading={setUploading}
              uploadToCloudinaryViaBackend={uploadToCloudinaryViaBackend}
            />
            </fieldset>
          )}
        </div>
        </fieldset>
      </main>
    </div>
  );
}
