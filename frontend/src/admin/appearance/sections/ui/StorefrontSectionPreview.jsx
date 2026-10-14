import React, { lazy, Suspense } from 'react';
import { getSectionOverview } from '../sectionsOverviewModel';
import './storefrontSectionPreview.css';

const PUBLIC_SECTIONS = {
  tendencia: lazy(() => import('../../../../components/TrendingSection')),
  look: lazy(() => import('../../../../components/LookSection')),
  complementos: lazy(() => import('../../../../components/ComplementosLook')),
  categorias: lazy(() => import('../../../../components/CategoriasSection')),
  instagram: lazy(() => import('../../../../components/InstagramSection')),
  tiktok: lazy(() => import('../../../../components/TiktokSection')),
  informacion: lazy(() => import('../../../../components/InformacionSection')),
};

class StorefrontPreviewBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <p className="section-real-preview__empty">No se pudo cargar la vista previa. Revisa la sección y vuelve a abrir este paso.</p>;
    }
    return this.props.children;
  }
}

export default function StorefrontSectionPreview({ section, theme }) {
  const PublicSection = PUBLIC_SECTIONS[section?.id];
  const sections = theme.sections || [];
  const previewSections = sections.map((entry) => entry.id === section.id ? { ...entry, enabled: true } : entry);
  const previewSection = previewSections.find((entry) => entry.id === section.id);
  const overview = getSectionOverview(previewSection, previewSections);
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};
  const previewTheme = { ...theme, sections: previewSections };
  const previewStyle = {
    '--color-primary': colors.primary || '#111827',
    '--color-secondary': colors.secondary || '#4b5563',
    '--color-text': colors.text || '#111827',
    '--color-bg': colors.background || '#ffffff',
    '--color-accent': colors.accent || '#ef4444',
    '--font-base': fonts.base || 'system-ui, sans-serif',
    '--font-headings': fonts.headings || 'system-ui, sans-serif',
    '--font-size-base': `${fonts.fontSize || 16}px`,
    '--line-height-base': String(fonts.lineHeight || 1.6),
  };
  return (
    <section className="section-real-preview" aria-label="Vista real de la tienda">
      <header className="section-real-preview__header">
        <div><span className="section-real-preview__eyebrow">Vista real</span><h3>Así verá el cliente esta sección</h3></div>
        <p>Usa tus cambios actuales. Cierra el editor y pulsa Guardar cambios para publicarlos en la tienda.</p>
      </header>
      {section.enabled === false && <p className="section-real-preview__notice">Esta sección está oculta en la tienda. La mostramos aquí para que puedas diseñarla.</p>}
      <div className="section-real-preview__viewport" data-admin-storefront-preview="true" style={previewStyle} onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}>
        {overview.status === 'needs-content' ? (
          <div className="section-real-preview__empty"><strong>Aún falta contenido para mostrarla.</strong><span>{overview.detail}. Vuelve a Contenido y completa esos datos.</span></div>
        ) : PublicSection ? (
          <StorefrontPreviewBoundary key={section.id}>
            <Suspense fallback={<p className="section-real-preview__loading">Preparando vista de la tienda…</p>}>
              <PublicSection theme={previewTheme} posts={[]} imageSrc="/SeccionComplementos/Complementos.png" />
            </Suspense>
          </StorefrontPreviewBoundary>
        ) : <p className="section-real-preview__empty">Esta sección no tiene una vista pública disponible.</p>}
      </div>
      <p className="section-real-preview__footnote">La vista usa el mismo componente de la página pública. Los botones de compra y los enlaces están desactivados dentro del editor.</p>
    </section>
  );
}
