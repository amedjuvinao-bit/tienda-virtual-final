import { normalizeComplementosSection } from '../complementos/complementosSectionHelpers';
import React, { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
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
  footer: lazy(() => import('../../../../components/FooterSection')),
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
      return <p className="section-real-preview__empty">No se pudo cargar la vista previa. Revisa la sección y vuelve a abrir el editor.</p>;
    }
    return this.props.children;
  }
}

function previewDevice(mode = 'auto') {
  if (mode === 'mobile') return { width: 390, label: 'Móvil' };
  if (mode === 'tablet') return { width: 768, label: 'Tablet' };
  if (mode === 'wide') return { width: 1920, label: 'Escritorio amplio' };
  if (mode === 'desktop') return { width: 1280, label: 'Escritorio' };
  if (typeof window === 'undefined') return { width: 1280, label: 'Escritorio' };
  if (window.innerWidth <= 767) return { width: 390, label: 'Móvil' };
  if (window.innerWidth <= 1024) return { width: 768, label: 'Tableta' };
  return { width: 1280, label: 'Escritorio' };
}

export default function StorefrontSectionPreview({ section, theme }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const [viewMode, setViewMode] = useState('auto');
  const [frame, setFrame] = useState(() => ({ ...previewDevice(), scale: 1, height: 320 }));
  const canChooseDevice = ['tendencia', 'complementos', 'categorias', 'instagram', 'tiktok', 'informacion', 'footer'].includes(section.id);
  const fitWholeSection = ['informacion', 'footer'].includes(section.id);
  const sections = theme.sections || [];
  const previewSections = sections.map((entry) => entry.id === section.id
    ? { ...(section.id === 'complementos' ? normalizeComplementosSection(entry) : entry), enabled: true } : entry);
  const previewSection = previewSections.find((entry) => entry.id === section.id);
  const overview = section.id === 'footer' ? {status:'ready'} : getSectionOverview(previewSection, previewSections);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport) return undefined;

    const measure = () => {
      const device = previewDevice(canChooseDevice ? viewMode : 'auto');
      const availableWidth = viewport.clientWidth || device.width;
      const contentHeight = Math.max(260, canvas?.scrollHeight || 0);
      let maxHeight = Infinity;
      if (fitWholeSection) {
        const preview = viewport.parentElement;
        const column = viewport.closest('.section-editor-layout__preview');
        const scrollArea = viewport.closest('[data-section-modal-scroll]');
        const positive = value => Number.isFinite(value) && value > 0 ? value : Infinity;
        const chromeHeight = [...(preview?.children || [])].filter(el => el !== viewport).reduce((sum, el) => {
          const css = window.getComputedStyle(el);
          return sum + el.offsetHeight + (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
        }, 2);
        const scrollStyle = scrollArea && window.getComputedStyle(scrollArea);
        const modalSpace = scrollArea ? scrollArea.clientHeight - (parseFloat(scrollStyle.paddingTop) || 0) - (parseFloat(scrollStyle.paddingBottom) || 0) : Infinity;
        const columnSpace = column ? parseFloat(window.getComputedStyle(column).maxHeight) : Infinity;
        maxHeight = Math.min(positive(parseFloat(window.getComputedStyle(viewport).maxHeight)), Math.max(80, Math.min(positive(modalSpace), positive(columnSpace)) - chromeHeight));
      }
      const scale = Math.min(1, availableWidth / device.width, Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight / contentHeight : 1);
      const height = fitWholeSection ? Math.floor(contentHeight * scale) : Math.ceil(contentHeight * scale);
      const left = fitWholeSection ? Math.max(0, (availableWidth - device.width * scale) / 2) : 0;
      setFrame((current) => current.width === device.width && current.scale === scale && current.height === height && current.left === left
        ? current : { ...device, scale, height, left });
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(viewport);
    if (canvas) observer?.observe(canvas);
    if (fitWholeSection) [...viewport.parentElement.children].filter(el => el !== viewport).forEach(el => observer?.observe(el));
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [section?.id, viewMode, overview.status, canChooseDevice, fitWholeSection]);

  const PublicSection = PUBLIC_SECTIONS[section?.id];
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};
  const previewTheme = { ...theme, sections: previewSections };
  const previewProducts = section?.id === 'tendencia' && Array.isArray(section.config?.products)
    ? section.config.products.filter((item) => item && typeof item === 'object' && item.productId).map((item) => ({
        id: String(item.productId),
        name: item.name || 'Producto seleccionado',
        image1: item.mainImage || item.images?.[0] || '/placeholder.png',
        image2: item.hoverImage || item.mainImage || item.images?.[0] || '/placeholder.png',
        price: Number(item.price) || 0,
        finalPrice: Number(item.finalPrice) || Number(item.price) || 0,
        hasDiscount: Boolean(item.hasDiscount),
        discountPercent: Number(item.discountPercent) || 0,
        sizes: [], colors: [], features: [], description: '',
      }))
    : section?.id === 'look' && Array.isArray(section.config?.products)
      ? section.config.products
      : undefined;
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
    <section className={'section-real-preview' + (fitWholeSection ? ' section-real-preview--fit' : '')} aria-label="Vista real de la tienda">
      <header className="section-real-preview__header">
        <div><span className="section-real-preview__eyebrow">Vista previa · {frame.label} {frame.width} px</span><h3>Así se verá en la tienda</h3></div>
        {canChooseDevice && <div className="section-real-preview__devices" role="group" aria-label="Dispositivo de vista previa">
          {[['auto', 'Automática'], ['mobile', 'Vista móvil'], ...(fitWholeSection ? [['tablet', 'Vista tablet']] : []), ['desktop', 'Vista escritorio'], ...(['categorias', 'instagram', 'tiktok'].includes(section.id) ? [['wide', 'Vista escritorio amplio']] : [])].map(([value, label]) =>
            <button key={value} type="button" aria-label={label} aria-pressed={viewMode === value} onClick={() => setViewMode(value)}>{fitWholeSection ? ({ auto: 'Auto', mobile: 'Móvil', tablet: 'Tablet', desktop: 'Escritorio' })[value] : label}</button>)}
        </div>}
      </header>
      {section.enabled === false && <p className="section-real-preview__notice">Esta sección está oculta en la tienda. La mostramos aquí para que puedas diseñarla.</p>}
      <div ref={viewportRef} className="section-real-preview__viewport" data-admin-storefront-preview="true" style={previewStyle} onClickCapture={(event) => {
        if (section.id === 'informacion' && event.target.closest('.info-glass button')) return;
        if (section.id === 'footer' && event.target.closest('.footer-ed button,.footer-ed input,.footer-ed label')) return;
        if (section.id === 'tiktok' && event.target.closest('.tk-stage button, .tk-stage input')) return;
        if (section.id === 'instagram' && event.target.closest('.ig-journal button, .ig-journal__connection-state button')) return;
        if (section.id === 'look' && event.target.closest('.look-editorial__card-image, .look-editorial__hero-controls button, .look-editorial__rail-controls button')) return;
        if (section.id === 'tendencia' && event.target.closest('.trending-runway__select, .trending-runway__hint, .trending-runway__pagination button')) return;
        event.preventDefault();
        event.stopPropagation();
      }}>
        {overview.status === 'needs-content' ? (
          <div className="section-real-preview__empty"><strong>Agrega contenido para verla aquí.</strong><span>{overview.detail}. Completa los datos en Contenido y la vista aparecerá automáticamente.</span></div>
        ) : PublicSection ? (
          <div className="section-real-preview__stage" style={{ height: frame.height }}>
            <div ref={canvasRef} className="section-real-preview__canvas" style={{ width: frame.width, left: frame.left || 0, transform: `scale(${frame.scale})` }}>
              <StorefrontPreviewBoundary key={section.id}>
                <Suspense fallback={<p className="section-real-preview__loading">Preparando vista de la tienda…</p>}>
                  <PublicSection theme={previewTheme} posts={[]} imageSrc="/SeccionComplementos/Complementos.png" previewProducts={previewProducts} preview={section.id === 'footer'} />
                </Suspense>
              </StorefrontPreviewBoundary>
            </div>
          </div>
        ) : <p className="section-real-preview__empty">Esta sección no tiene una vista pública disponible.</p>}
      </div>
      <p className="section-real-preview__footnote">Los cambios aparecen aquí al instante. Pulsa Guardar cambios al salir para publicarlos.</p>
    </section>
  );
}
