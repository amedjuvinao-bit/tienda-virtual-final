import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, CircleHelp, Eye, EyeOff, Heart, Images, Info, Music2, Pencil, Shirt, Sparkles } from "lucide-react";
import LookSectionUI from "./look/LookSectionUI";
import ComplementosSectionUI from "./complementos/ComplementosSectionUI";
import CategoriasSectionUI from "./categorias/CategoriasSectionUI";
import InstagramSectionUI from "./instagram/InstagramSectionUI";
import TiktokSectionUI from "./tiktok/TiktokSectionUI";
import InfoSectionUI from "./info/infoSectionUI";
import { getSectionOverview } from "./sectionsOverviewModel";
import SectionEditorSteps from "./ui/SectionEditorSteps";
import StorefrontSectionPreview from "./ui/StorefrontSectionPreview";
import { TiktokEditorFeedProvider } from "../../../components/tiktok/TiktokEditorFeed";
import { InstagramEditorFeedProvider } from "../../../components/instagram/InstagramEditorFeed";
import { ModalShell } from "./ui/SectionsPanelUI";
import BasicTab from "./BasicTab.jsx";
import ImageTab from "./ImageTab.jsx";
import StylesTab from "./StylesTab.jsx";
import ProductsTab from "./ProductsTab.jsx";
import { ensureGoogleFontsLoaded, normalizeTendenciaConfigPlus, normalizeSection, normalizeSectionsArray, cloneSections } from "./sectionEditorModel";
import './sectionsOverview.css';

const OVERVIEW_ICONS = {
  tendencia: Sparkles,
  look: Shirt,
  complementos: Heart,
  categorias: Images,
  instagram: Images,
  tiktok: Music2,
  informacion: Info,
};

const OVERVIEW_STATUS = {
  ready: { label: 'Configurada', icon: CircleCheck },
  'needs-content': { label: 'Falta contenido', icon: CircleAlert },
  hidden: { label: 'Oculta', icon: EyeOff },
  unsupported: { label: 'Sin editor', icon: CircleHelp },
};

const OVERVIEW_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'ready', label: 'Configuradas' },
  { id: 'needs-content', label: 'Por completar' },
  { id: 'hidden', label: 'Ocultas' },
];

export default function SectionsPanel({ theme, setPath, disabled = false, uploading, setUploading, uploadToCloudinary }) {
  const initialSections = useMemo(() => normalizeSectionsArray(theme || {}), [theme]);

  const [sections, setSections] = useState(() => cloneSections(initialSections));
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("basic");
  const [overviewFilter, setOverviewFilter] = useState('all');

  const lastIncomingFromThemeRef = useRef(JSON.stringify(initialSections));
  const lastPushedToParentRef = useRef(JSON.stringify(initialSections));

  useEffect(() => {
    ensureGoogleFontsLoaded();
  }, []);

  useEffect(() => {
    const normalizedIncoming = normalizeSectionsArray(theme || {});
    const incomingSerialized = JSON.stringify(normalizedIncoming);

    if (incomingSerialized === lastIncomingFromThemeRef.current) return;

    lastIncomingFromThemeRef.current = incomingSerialized;

    if (incomingSerialized === lastPushedToParentRef.current) return;

    if (editingId) return;

    setSections(cloneSections(normalizedIncoming));
  }, [theme, editingId]);

  useEffect(() => {
    if (typeof setPath !== "function") return;

    const normalizedForParent = sections.map((sec, idx) => normalizeSection(sec, idx));
    const serialized = JSON.stringify(normalizedForParent);

    if (serialized === lastPushedToParentRef.current) return;

    lastPushedToParentRef.current = serialized;
    lastIncomingFromThemeRef.current = serialized;
    setPath("sections", normalizedForParent);
  }, [sections, setPath]);

  const selected = useMemo(() => sections.find((s) => s.id === editingId) || null, [sections, editingId]);
  const overview = useMemo(() => sections.map((section) => ({
    section,
    ...getSectionOverview(section, sections),
  })), [sections]);
  const visibleOverview = overviewFilter === 'all'
    ? overview
    : overview.filter((item) => item.status === overviewFilter);

  const isLookSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "look" || selected.type === "look";
  }, [selected]);

  const isComplementosSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "complementos" || selected.type === "complementos";
  }, [selected]);

  const isCategoriasSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "categorias" || selected.type === "categorias";
  }, [selected]);

  const isInstagramSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "instagram" || selected.type === "instagram";
  }, [selected]);

  const isTiktokSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "tiktok" || selected.type === "tiktok";
  }, [selected]);

  const isInfoSection = useMemo(() => {
    if (!selected) return false;
    return selected.id === "informacion" || selected.type === "informacion";
  }, [selected]);

  

  const updateSections = (updater) => {
    setSections((prev) => {
      const base = cloneSections(prev);
      const next = typeof updater === "function" ? updater(base) : updater;
      return cloneSections(next);
    });
  };

  const patchSection = (id, partial) => {
    updateSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== id) return sec;

        const nextPartial = typeof partial === "function" ? partial(sec) : partial || {};

        const merged = {
          ...sec,
          ...nextPartial,
          style: {
            ...(sec.style || {}),
            ...(nextPartial.style || {}),
          },
          config: {
            ...(sec.config || {}),
            ...(nextPartial.config || {}),
          },
        };

        if (merged.type === "tendencia") {
          merged.config = normalizeTendenciaConfigPlus(merged.config);
        }

        return merged;
      })
    );
  };

  const handleChangeSelected = (partial) => {
    if (!selected) return;
    patchSection(selected.id, partial);
  };

  const openEditor = (id) => {
    setEditingId(id);
    setActiveTab("basic");
  };

  const closeEditor = () => {
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <section className="sections-overview" aria-label="Vista general de secciones">
        <div className="sections-overview__head">
          <div>
            <h2>Secciones de la tienda</h2>
            <p>Elige un bloque para editarlo. Guarda los cambios con el botón lateral.</p>
          </div>
          <div className="sections-overview__stats" role="group" aria-label="Resumen de secciones">
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'ready').length}</strong> configuradas</span>
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'needs-content').length}</strong> por completar</span>
            <span className="sections-overview__stat"><strong>{overview.filter((item) => item.status === 'hidden').length}</strong> ocultas</span>
          </div>
        </div>
        <div className="sections-overview__filters" role="group" aria-label="Filtrar secciones">
          {OVERVIEW_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="sections-overview__filter"
              aria-pressed={overviewFilter === filter.id}
              onClick={() => setOverviewFilter(filter.id)}
            >{filter.label}</button>
          ))}
        </div>
        <div className="sections-overview__grid">
          {visibleOverview.map(({ section, label, status, detail }) => {
            const Icon = OVERVIEW_ICONS[section.id] || CircleHelp;
            const StatusIcon = OVERVIEW_STATUS[status].icon;
            return (
              <article className="sections-overview__card" data-status={status} key={section.id}>
                <span className="sections-overview__icon" aria-hidden="true"><Icon /></span>
                <div className="sections-overview__content">
                  <h3 title={section.name}>{label}</h3>
                  <p>{detail}</p>
                  <span className="sections-overview__status" data-status={status}><StatusIcon aria-hidden="true" />{OVERVIEW_STATUS[status].label}</span>
                </div>
                {status !== 'unsupported' && <div className="sections-overview__actions">
                  <button
                    type="button"
                    role="switch"
                    className="sections-overview__toggle"
                    aria-label={`Mostrar ${label} en la tienda`}
                    aria-checked={section.enabled !== false}
                    title={section.enabled === false ? `Mostrar ${label}` : `Ocultar ${label}`}
                    onClick={() => patchSection(section.id, { enabled: section.enabled === false })}
                  >{section.enabled === false ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
                  <button
                    type="button"
                    className="sections-overview__edit"
                    aria-label={`Editar ${label}`}
                    title={`Editar ${label}`}
                    onClick={() => openEditor(section.id)}
                  ><Pencil aria-hidden="true" /></button>
                </div>}
              </article>
            );
          })}
        </div>
        {!visibleOverview.length && <p className="sections-overview__empty">No hay secciones en este estado.</p>}
      </section>

      {selected ? (
      <ModalShell onClose={closeEditor} title={`Editar sección: ${selected.name}`} disabled={disabled}>
        <InstagramEditorFeedProvider enabled={isInstagramSection}>
        <TiktokEditorFeedProvider enabled={isTiktokSection}>
        <div className="section-editor-layout">
        <div className="section-editor-layout__form">
        {isLookSection ? (
          <LookSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isComplementosSection ? (
          <ComplementosSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isCategoriasSection ? (
          <CategoriasSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
        ) : isInstagramSection ? (
          <InstagramSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
          ) : isTiktokSection ? (
          <TiktokSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
          />
          ) : isInfoSection ? (
          <InfoSectionUI
            theme={{ ...theme, sections }}
            setPath={(path, value) => {
              if (path !== "sections") return;
              const nextSections = Array.isArray(value)
                ? value.map((sec, idx) => normalizeSection(sec, idx))
                : [];
              setSections(cloneSections(nextSections));
            }}
            uploadToCloudinary={uploadToCloudinary}
            uploading={uploading}
          />
        ) : (
          <>
            <SectionEditorSteps value={["image", "products"].includes(activeTab) ? "basic" : activeTab} onChange={setActiveTab} sectionName="En tendencia" items={[
              { value: "basic", label: "Contenido", hint: "Define el título, las imágenes y los productos de la sección." },
              { value: "styles", label: "Diseño", hint: "Ajusta colores, tarjetas, tipografía y efectos." },
            ]} />
            {["basic", "image", "products"].includes(activeTab) && (
              <nav className="section-editor-substeps mt-3" aria-label="Opciones de contenido">
                {[{ value: "basic", label: "Textos" }, { value: "image", label: "Imágenes" }, { value: "products", label: "Productos" }].map((item) => (
                  <button key={item.value} type="button" aria-pressed={activeTab === item.value} onClick={() => setActiveTab(item.value)}>{item.label}</button>
                ))}
              </nav>
            )}

            <div className="pt-4">
              {activeTab === "basic" ? <BasicTab section={selected} onChange={handleChangeSelected} /> : null}

              {activeTab === "image" && selected.type === "tendencia" ? (
                <ImageTab
                  section={selected}
                  onChange={handleChangeSelected}
                  uploadToCloudinary={uploadToCloudinary}
                  uploading={uploading}
                />
              ) : null}

              {activeTab === "styles" ? <StylesTab section={selected} onChange={handleChangeSelected} uploadToCloudinary={uploadToCloudinary} /> : null}

              {activeTab === "products" && selected.type === "tendencia" ? (
                <ProductsTab section={selected} onChange={handleChangeSelected} uploadToCloudinary={uploadToCloudinary} />
              ) : null}

            </div>
          </>
        )}
        </div>
        <aside className="section-editor-layout__preview">
          <StorefrontSectionPreview section={selected} theme={{ ...theme, sections }} />
        </aside>
        </div>
        </TiktokEditorFeedProvider>
        </InstagramEditorFeedProvider>
      </ModalShell>
      ) : null}
    </div>
  );
}
