import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../../config/apiBaseUrl';
import { BANNER_BUTTON_ANIMATIONS, getBannerTemplate, moveBannerButtonLight, safeHotspotColor } from '../../../lib/bannerTemplates';

const Field = ({ label, ...props }) => <label className="banner-template-field"><span>{label}</span><input {...props} /></label>;

const COPY_PARTS = [
  { key: 'eyebrow', name: 'Texto superior', link: 'eyebrowLink' },
  { key: 'title', name: 'Título principal', link: 'titleLink' },
  { key: 'description', name: 'Descripción', link: 'descriptionLink' },
  { key: 'footerText', name: 'Texto de categorías', link: 'footerTextLink' },
];

export default function BannerTemplatePanel({ theme, setPath, uploading, setUploading, uploadToCloudinaryViaBackend, selection, onSelectionChange, placingCard = null, onStartPlacing }) {
  const banner = theme?.banner || {};
  const { id, config, categories } = getBannerTemplate(banner, theme?.sections);
  const [localSelection, setLocalSelection] = useState('copy:title');
  const [error, setError] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState('');
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/products/catalog-categories`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las categorías.');
        return response.json();
      })
      .then((data) => {
        setCatalogCategories(Array.isArray(data.categories) ? data.categories : []);
        setCatalogError('');
      })
      .catch((cause) => {
        if (cause.name !== 'AbortError') setCatalogError('No se pudieron cargar las categorías del catálogo. Recarga la página.');
      })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, []);
  const selected = selection || localSelection;
  const choose = onSelectionChange || setLocalSelection;
  const group = selected.startsWith('action:') ? 'actions' : selected.startsWith('card:') ? 'categories' : selected.startsWith('trust:') ? 'trust' : selected === 'style' ? 'style' : 'copy';
  useEffect(() => {
    const query = productQuery.trim();
    if (group !== 'categories' || query.length < 2) {
      setProductResults([]);
      setProductLoading(false);
      setProductError('');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setProductLoading(true);
      setProductError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/products?q=${encodeURIComponent(query)}&limit=12`, { signal: controller.signal });
        if (!response.ok) throw new Error('No se pudieron buscar los productos.');
        const data = await response.json();
        setProductResults(Array.isArray(data.products) ? data.products : []);
      } catch (cause) {
        if (cause.name !== 'AbortError') {
          setProductResults([]);
          setProductError('No se pudo consultar el catálogo. Inténtalo de nuevo.');
        }
      } finally {
        if (!controller.signal.aborted) setProductLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [group, productQuery]);
  const current = banner.templateConfigs?.[id] || {};
  const update = (patch) => setPath(`banner.templateConfigs.${id}`, (latest = {}) => ({ ...latest, ...patch }));
  const cardTextStyle = current.cardTextStyle || {};
  const updateCardTextStyle = (patch) => setPath(`banner.templateConfigs.${id}.cardTextStyle`, (latest = {}) => ({ ...latest, ...patch }));
  const updateAction = (key, patch) => update({ [key]: { ...config[key], ...patch } });
  const maxCards = id === 'atelier' ? 2 : id === 'editorial' ? 8 : 3;
  const refs = Array.isArray(current.cards) && current.cards.length
    ? current.cards
    : categories.slice(0, maxCards).map((category, index) => ({ categoryId: category.id, enabled: true, x: id === 'atelier' ? 45 + index * 29 : 68 + index * 13, y: id === 'atelier' ? 28 + index * 24 : 42 + index * 26 }));
  const updateCard = (index, patch) => setPath(`banner.templateConfigs.${id}.cards`, (latest) => {
    const cards = Array.isArray(latest) && latest.length ? latest : refs;
    return cards.map((card, i) => i === index ? { ...card, ...patch } : card);
  });
  const uploadCardImage = async (index, file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, 'image');
      updateCard(index, { image: url, imageSource: 'custom' });
    } catch (cause) {
      setError(cause?.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const uploadCardDecoration = async (index, file) => {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) {
      setError('Usa una imagen PNG, WebP o JPG.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, 'image');
      updateCard(index, { decorationImage: url, decorationMode: 'custom' });
    } catch (cause) {
      setError(cause?.message || 'No se pudo subir la imagen decorativa.');
    } finally {
      setUploading(false);
    }
  };

  const updateTrust = (index, patch) => update({
    trustItems: config.trustItems.map((item, i) => i === index ? { ...item, ...patch } : item),
  });
  const uploadTrustImage = async (index, file) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadToCloudinaryViaBackend(file, 'image');
      updateTrust(index, { image: url });
    } catch (cause) {
      setError(cause?.message || 'No se pudo subir el icono.');
    } finally {
      setUploading(false);
    }
  };

  const copyParts = id === 'atelier' ? COPY_PARTS.slice(0, 3) : COPY_PARTS;
  const selectedCopy = copyParts.find((part) => selected === `copy:${part.key}`) || copyParts[1];
  const actionKey = selected === 'action:secondary' ? 'secondary' : 'primary';
  const index = Math.min(Math.max(Number(selected.split(':')[1]) || 0, 0), Math.max(0, refs.length - 1));
  const card = refs[index];
  const category = categories.find((entry) => entry.id === card?.categoryId);
  const destinationType = card?.destinationType || (categories.length ? 'category' : 'catalogCategory');
  const categoryImage = destinationType === 'product' ? card?.featuredProductImage : destinationType === 'catalogCategory' ? card?.catalogCategoryImage : category?.image;
  const cardImage = card?.image && card?.imageSource !== 'catalog' ? card.image : categoryImage;

  return <div className="banner-template-editor">
    <div className="banner-template-editor__intro"><strong>Personaliza el diseño</strong><span>Elige una parte o tócala en la vista previa. Se guarda junto con la portada.</span></div>
    <div className="banner-template-tabs" role="group" aria-label="Parte de la portada">
      <button type="button" aria-pressed={group === 'copy'} onClick={() => choose('copy:title')}>① Mensajes</button>
      <button type="button" aria-pressed={group === 'actions'} onClick={() => choose('action:primary')}>② Botones</button>
      <button type="button" aria-pressed={group === 'categories'} onClick={() => choose('card:0')}>③ Categorías</button>
      {id === 'editorial' && <button type="button" aria-pressed={group === 'trust'} onClick={() => choose('trust:0')}>④ Distintivos</button>}
      <button type="button" aria-pressed={group === 'style'} onClick={() => choose('style')}>{id === 'editorial' ? '⑤' : '④'} Colores</button>
    </div>

    {group === 'copy' && <div className="banner-template-inspector">
      <div className="banner-template-parts" role="group" aria-label="Texto para editar">
        {copyParts.map((part) => <button key={part.key} type="button" aria-pressed={selectedCopy.key === part.key} onClick={() => choose(`copy:${part.key}`)}>
          <small>{part.name}</small><strong>{config[part.key] || 'Sin texto'}</strong>
        </button>)}
      </div>
      <div className="banner-template-inspector__fields">
        <strong>Editar {selectedCopy.name.toLowerCase()}</strong>
        {selectedCopy.key === 'description'
          ? <label className="banner-template-field"><span>Texto que verá el cliente</span><textarea rows="2" value={config.description || ''} onChange={(event) => update({ description: event.target.value })} /></label>
          : <Field label={selectedCopy.key === 'title' ? 'Título' : 'Texto que verá el cliente'} value={config[selectedCopy.key] || ''} onChange={(event) => update({ [selectedCopy.key]: event.target.value })} />}
        <details className="banner-template-more" open={!!config[selectedCopy.link]}><summary>Enlace de este texto <span>opcional</span></summary>
          <Field label="Al hacer clic, ir a" placeholder="/categoria/... o https://..." value={config[selectedCopy.link] || ''} onChange={(event) => update({ [selectedCopy.link]: event.target.value })} />
        </details>
      </div>
    </div>}

    {group === 'actions' && <div className="banner-template-buttons">
      <div className="banner-template-motion-head"><strong>Animación de los botones</strong><span>Elige un estilo para los botones y todas las tarjetas de categorías de la portada. Pasa el mouse por cada muestra y observa la portada.</span></div>
      <div className="banner-template-motion-choices" role="group" aria-label="Animación de los botones">
        {BANNER_BUTTON_ANIMATIONS.map((preset) => <button key={preset.id} type="button" className="banner-template-motion-choice" aria-pressed={config.buttonAnimation === preset.id} onClick={() => update({ buttonAnimation: preset.id })}>
          <span className="banner-template-motion-choice__stage"><span className="banner-template-motion-choice__demo rb-liquid-button" data-button-animation={preset.id} onPointerMove={moveBannerButtonLight} aria-hidden="true"><span>Explorar</span><span>↗</span></span></span>
          <strong>{preset.name}</strong><small>{preset.description}</small>
        </button>)}
      </div>
      <div className="banner-template-inspector">
      <div className="banner-template-parts" role="group" aria-label="Botón para editar">
        {['primary', 'secondary'].map((key) => <button key={key} type="button" aria-pressed={actionKey === key} onClick={() => choose(`action:${key}`)}>
          <small>{key === 'primary' ? 'Botón principal' : 'Botón secundario'}</small><strong>{config[key].text || 'Sin texto'}</strong>
        </button>)}
      </div>
      <div className="banner-template-inspector__fields">
        <strong>{actionKey === 'primary' ? 'Botón principal' : 'Botón secundario'}</strong>
        <label className="banner-template-toggle"><input type="checkbox" checked={config[actionKey].enabled !== false} onChange={(event) => updateAction(actionKey, { enabled: event.target.checked })} /> Mostrar en la portada</label>
        <Field label="Texto del botón" value={config[actionKey].text || ''} onChange={(event) => updateAction(actionKey, { text: event.target.value })} />
        <Field label="Al hacer clic, ir a" placeholder="/categoria/... o https://..." value={config[actionKey].link || ''} onChange={(event) => updateAction(actionKey, { link: event.target.value })} />
        {!config[actionKey].link?.trim() && config[actionKey].enabled !== false && <p className="banner-template-help" role="status">Este botón aún no abre ninguna página. Escribe un enlace y guarda la portada para activarlo en la tienda.</p>}
      </div>
      </div>
    </div>}

    {group === 'categories' && <div className="banner-template-inspector banner-template-inspector--cards">
      <div className="banner-template-cards-heading"><strong>Accesos del banner</strong><span>Elige una tarjeta y asígnale una categoría del catálogo o un producto.</span></div>
        <details className="banner-template-card-details"><summary>Texto de todas las tarjetas</summary>
          <p className="banner-template-help">Estos colores, tamaños y el acabado metalizado se aplican a todas las tarjetas de este diseño, incluso a las que añadas después.</p>
          <div className="banner-template-color-grid">
            <Field type="color" label="Color de los títulos" value={cardTextStyle.titleColor || refs[0]?.titleColor || config.textColor || '#ffffff'} onChange={(event) => updateCardTextStyle({ titleColor: event.target.value })} />
            <Field type="color" label="Color de las etiquetas" value={cardTextStyle.labelColor || refs[0]?.labelColor || config.accentColor || '#ffffff'} onChange={(event) => updateCardTextStyle({ labelColor: event.target.value })} />
          </div>
          <div className="banner-template-color-grid">
            <label className="banner-template-field"><span>Tamaño de los títulos · {cardTextStyle.titleSizePx ?? refs[0]?.titleSizePx ?? 'original'}{(cardTextStyle.titleSizePx ?? refs[0]?.titleSizePx) ? ' px' : ''}</span><input type="range" min="10" max="24" value={cardTextStyle.titleSizePx ?? refs[0]?.titleSizePx ?? 14} onChange={(event) => updateCardTextStyle({ titleSizePx: Number(event.target.value) })} /></label>
            <label className="banner-template-field"><span>Tamaño de las etiquetas · {cardTextStyle.labelSizePx ?? refs[0]?.labelSizePx ?? 'original'}{(cardTextStyle.labelSizePx ?? refs[0]?.labelSizePx) ? ' px' : ''}</span><input type="range" min="8" max="18" value={cardTextStyle.labelSizePx ?? refs[0]?.labelSizePx ?? 10} onChange={(event) => updateCardTextStyle({ labelSizePx: Number(event.target.value) })} /></label>
          </div>
          <label className="banner-template-toggle"><input type="checkbox" checked={cardTextStyle.metallicTitle === true} onChange={(event) => updateCardTextStyle({ metallicTitle: event.target.checked })} /> Acabado metalizado en los títulos</label>
        </details>
        <div className="banner-template-parts" role="group" aria-label="Acceso de categoría para editar">
          {refs.map((entry, cardIndex) => {
            const linked = categories.find((item) => item.id === entry.categoryId);
            return <button key={cardIndex} type="button" aria-pressed={index === cardIndex} onClick={() => { setProductQuery(''); choose(`card:${cardIndex}`); }}>
              <small>{String(cardIndex + 1).padStart(2, '0')} {entry.enabled === false ? '· Oculto' : '· Visible'}</small><strong>{entry.text || (entry.destinationType === 'product' ? entry.featuredProductTitle : entry.destinationType === 'catalogCategory' ? entry.catalogCategoryName : linked?.title) || 'Elige un destino'}</strong>
            </button>;
          })}
          {refs.length < maxCards && <button type="button" className="banner-template-parts__add" onClick={() => { const nextCategory = catalogCategories.find((item) => !refs.some((ref) => ref.catalogCategoryId === item.id)); update({ cards: [...refs, { destinationType: 'catalogCategory', catalogCategoryId: nextCategory?.id || '', catalogCategoryName: nextCategory?.name || '', catalogCategoryImage: nextCategory?.image || '', enabled: true, x: 75, y: 68 }] }); choose(`card:${refs.length}`); }}>+ Añadir acceso</button>}
        </div>
        {card && <div className="banner-template-inspector__fields">
          <div className="banner-template-card-heading"><strong>Tarjeta {index + 1}</strong><label className="banner-template-toggle"><input type="checkbox" checked={card.enabled !== false} onChange={(event) => updateCard(index, { enabled: event.target.checked })} /> Visible en la portada</label></div>
          <div className="banner-template-card-route"><label className="banner-template-field"><span>Al hacer clic, abrir</span><select value={destinationType} onChange={(event) => {
            const nextType = event.target.value;
            const first = catalogCategories[0];
            updateCard(index, { destinationType: nextType, text: '', label: '', image: '',
              ...(nextType === 'catalogCategory' ? { catalogCategoryId: first?.id || '', catalogCategoryName: first?.name || '', catalogCategoryImage: first?.image || '' } : {}) });
            setProductQuery('');
          }}>
            <option value="catalogCategory">Una categoría del catálogo</option>
            <option value="product">Un producto</option>
            {categories.length > 0 && (card.categoryId || destinationType === 'category') && <option value="category">Acceso de Apariencia (anterior)</option>}
          </select></label>
          {destinationType === 'catalogCategory' && <>
            {catalogLoading && <p role="status">Cargando categorías del catálogo…</p>}
            {catalogError && <p role="alert">{catalogError}</p>}
            {!catalogLoading && !catalogError && <label className="banner-template-field"><span>Categoría del catálogo</span><select value={card.catalogCategoryId || ''} onChange={(event) => {
              const selectedCategory = catalogCategories.find((entry) => entry.id === event.target.value);
              updateCard(index, { catalogCategoryId: selectedCategory?.id || '', catalogCategoryName: selectedCategory?.name || '', catalogCategoryImage: selectedCategory?.image || '', label: '', text: '', image: '' });
            }}>
              {(!card.catalogCategoryId || !catalogCategories.some((entry) => entry.id === card.catalogCategoryId)) && <option value={card.catalogCategoryId || ''}>{card.catalogCategoryId ? 'Categoría anterior no disponible' : 'Selecciona una categoría'}</option>}
              {catalogCategories.map((entry) => <option key={entry.id} value={entry.id}>{entry.path || entry.name}</option>)}
            </select></label>}
            {!catalogLoading && !catalogError && catalogCategories.length === 0 && <p className="banner-template-help">No hay categorías en Productos. Créalas en el catálogo para usarlas aquí.</p>}
            {card.catalogCategoryName && <p className="banner-template-help">Esta tarjeta abrirá los productos de “{card.catalogCategoryName}”.</p>}
          </>}
          {destinationType === 'category' && <>
            <label className="banner-template-field"><span>Acceso anterior</span><select value={card.categoryId || ''} onChange={(event) => updateCard(index, { categoryId: event.target.value, label: '', text: '', image: '' })}>{categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
            <p className="banner-template-help">Para mostrar productos reales, cambia el destino a categoría del catálogo.</p>
          </>}
          {destinationType === 'product' && <div className="banner-template-product-picker">
            <label className="banner-template-field"><span>Buscar producto</span><input type="search" placeholder="Escribe el nombre o código" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} /></label>
            {card.featuredProductId && <p className="banner-template-product-picker__selected">Producto elegido: <strong>{card.featuredProductTitle || card.featuredProductId}</strong></p>}
            {productLoading && <p role="status">Buscando productos…</p>}
            {productError && <p role="alert">{productError}</p>}
            {productQuery.trim().length >= 2 && !productLoading && !productError && <div className="banner-template-product-picker__results">
              {productResults.length ? productResults.map((product) => {
                const image = product.images?.cover || product.image || product.images?.[0] || '';
                return <button key={product._id} type="button" onClick={() => { updateCard(index, { featuredProductId: product._id, featuredProductTitle: product.title, featuredProductImage: image, image: '', text: '', label: '' }); setProductQuery(''); }}>
                  {image && <img src={image} alt="" />}<span>{product.title}</span><small>Elegir</small>
                </button>;
              }) : <p>No se encontraron productos publicados.</p>}
            </div>}
            {!card.featuredProductId && <p className="banner-template-help">Busca y elige un producto para crear el enlace de la tarjeta.</p>}
          </div>}
          </div>
          <details className="banner-template-card-details"><summary>Texto e imágenes <span>opcional</span></summary>
          <Field label="Texto visible (opcional)" placeholder={(destinationType === 'product' ? card.featuredProductTitle : destinationType === 'catalogCategory' ? card.catalogCategoryName : category?.title) || ''} value={card.text || ''} onChange={(event) => updateCard(index, { text: event.target.value })} />
          <p className="banner-template-help">Si dejas el texto vacío, se muestra el nombre del destino seleccionado.</p>
          <div className="banner-template-card-media"><strong>Imagen de la tarjeta</strong><p className="banner-template-help">Se muestra la foto del {destinationType === 'product' ? 'producto' : 'categoría'}. Puedes subir otra imagen para esta tarjeta.</p>
            <Field label="Etiqueta pequeña" placeholder={(destinationType === 'product' ? card.featuredProductTitle : destinationType === 'catalogCategory' ? card.catalogCategoryName : category?.title) || ''} value={card.label || ''} onChange={(event) => updateCard(index, { label: event.target.value })} />
            <label className="banner-template-field"><span>Imagen propia</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => uploadCardImage(index, event.target.files?.[0])} /></label>
            {cardImage && <img src={cardImage} alt="Vista previa de la tarjeta" className="banner-template-card-media__preview" />}
            {card.image && <div className="banner-template-image-choice" role="group" aria-label="Imagen visible de la tarjeta">
              <button type="button" className="banner-btn" aria-pressed={card.imageSource !== 'catalog'} onClick={() => updateCard(index, { imageSource: 'custom' })}>Imagen que subí</button>
              <button type="button" className="banner-btn" aria-pressed={card.imageSource === 'catalog'} disabled={!categoryImage} onClick={() => updateCard(index, { imageSource: 'catalog' })}>Imagen de la {destinationType === 'product' ? 'ficha del producto' : 'categoría'}</button>
              <p className="banner-template-help">Puedes cambiar de opción sin perder la imagen que subiste.</p>
            </div>}
          </div>
          {id === 'editorial' && <div className="banner-template-florals">
            <strong>Imagen decorativa de esta tarjeta</strong>
            <p className="banner-template-help">Sube una imagen de ambiente que cubra toda la tarjeta. Una foto JPG o WebP sin bordes transparentes evita huecos; la foto del producto y los textos quedan independientes por encima.</p>
            <label className="banner-template-field"><span>Cargar o cambiar imagen decorativa</span><input type="file" accept="image/png,image/webp,image/jpeg" disabled={uploading} onChange={(event) => { uploadCardDecoration(index, event.target.files?.[0]); event.target.value = ''; }} /></label>
            {card.decorationImage && <>
              <div className="banner-template-florals__actions">
                <button type="button" className="banner-btn" aria-pressed={card.decorationMode === 'custom'} onClick={() => updateCard(index, { decorationMode: 'custom' })}>Mostrar imagen</button>
                <button type="button" className="banner-btn" aria-pressed={card.decorationMode === 'none'} onClick={() => updateCard(index, { decorationMode: 'none' })}>Ocultar imagen</button>
              </div>
              {card.decorationMode === 'custom' && <>
                <p className="banner-template-help">Haz clic o arrastra para elegir qué parte del fondo se verá en la tarjeta. Comprueba el resultado en la vista previa grande.</p>
                <div className="banner-template-florals__stage" role="img" aria-label="Encuadre del fondo de la tarjeta" onPointerDown={(event) => { if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return; event.currentTarget.setPointerCapture?.(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); if (rect.width && rect.height) updateCard(index, { decorationX: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))), decorationY: Math.round(Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))) }); }} onPointerMove={(event) => { if (!(event.buttons & 1) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return; const rect = event.currentTarget.getBoundingClientRect(); if (rect.width && rect.height) updateCard(index, { decorationX: Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))), decorationY: Math.round(Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))) }); }}>
                  <span className="banner-template-florals__art" style={{ backgroundImage: `url(${JSON.stringify(card.decorationImage)})`, backgroundPosition: `${card.decorationX ?? 50}% ${card.decorationY ?? 50}%`, transform: `scale(${Math.max(1, (card.decorationSize ?? 100) / 100)})`, opacity: (card.decorationOpacity ?? 75) / 100 }} />
                  {cardImage && <img src={cardImage} alt="" />}
                </div>
                <div className="banner-template-florals__controls">
                  <label>Acercamiento: {Math.max(100, card.decorationSize ?? 100)}%<input type="range" min="100" max="180" value={Math.max(100, card.decorationSize ?? 100)} onChange={(event) => updateCard(index, { decorationSize: Number(event.target.value) })} /></label>
                  <label>Transparencia: {100 - (card.decorationOpacity ?? 75)}%<input type="range" min="0" max="100" value={card.decorationOpacity ?? 75} onChange={(event) => updateCard(index, { decorationOpacity: Number(event.target.value) })} /></label>
                </div>
              </>}
            </>}
          </div>}
          </details>
          {id === 'atelier' && <details className="banner-template-card-details"><summary>Ubicación y señalador</summary><div className="banner-template-point-control">
            <p className="banner-template-help">Arrastra la tarjeta en la vista previa. La línea señala un punto en la imagen.</p>
            <button type="button" className="banner-btn banner-btn--primary" aria-pressed={placingCard === index} onClick={() => onStartPlacing?.(placingCard === index ? null : index)}>{placingCard === index ? 'Cancelar ubicación' : 'Señalar lugar en la imagen'}</button>
            {placingCard === index && <p className="banner-template-help" role="status">Ahora haz clic en el objeto que quieres señalar dentro de la vista previa.</p>}
            <div className="banner-template-position"><Field type="number" min="0" max="100" label="Punto horizontal %" value={card.x ?? 45 + index * 29} onChange={(event) => updateCard(index, { x: Number(event.target.value) })} /><Field type="number" min="0" max="100" label="Punto vertical %" value={card.y ?? 28 + index * 24} onChange={(event) => updateCard(index, { y: Number(event.target.value) })} /></div>
            <Field type="color" label="Color de línea y punto" value={safeHotspotColor(card.lineColor)} onChange={(event) => updateCard(index, { lineColor: event.target.value })} />
          </div></details>}

          {error && <p role="alert">{error}</p>}
        </div>}
    </div>}

    {group === 'trust' && id === 'editorial' && <div className="banner-template-inspector">
      <div className="banner-template-parts" role="group" aria-label="Distintivo para editar">
        {config.trustItems.map((item, itemIndex) => <button key={itemIndex} type="button" aria-pressed={selected === `trust:${itemIndex}`} onClick={() => choose(`trust:${itemIndex}`)}>
          <small>Distintivo {itemIndex + 1}</small><strong>{item.text || 'Sin texto'}</strong>
        </button>)}
      </div>
      {config.trustItems.map((item, itemIndex) => selected === `trust:${itemIndex}` && <div key={itemIndex} className="banner-template-inspector__fields">
        <strong>Distintivo {itemIndex + 1}</strong>
        <Field label="Texto visible" value={item.text || ''} onChange={(event) => updateTrust(itemIndex, { text: event.target.value })} />
        <label className="banner-template-field"><span>Imagen del icono (PNG o WebP transparente)</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { uploadTrustImage(itemIndex, event.target.files?.[0]); event.target.value = ''; }} /></label>
        {item.image ? <div className="banner-template-upload-preview"><img src={item.image} alt="Icono cargado" /><button type="button" className="banner-btn" onClick={() => updateTrust(itemIndex, { image: '' })}>Usar icono de cristal</button></div> : <p className="banner-template-help">Se muestra el icono de cristal prediseñado.</p>}
        {error && <p role="alert">{error}</p>}
      </div>)}
    </div>}

    {group === 'style' && <div className="banner-template-inspector__fields banner-template-inspector__fields--style">
      <strong>Colores y legibilidad</strong>
      <p className="banner-template-help">Prueba los colores sobre tu imagen o video en la vista previa.</p>
      <div className="banner-template-color-grid">
        <Field type="color" label="Texto" value={config.textColor || '#ffffff'} onChange={(event) => update({ textColor: event.target.value })} />
        <Field type="color" label="Acento" value={config.accentColor || '#ffffff'} onChange={(event) => update({ accentColor: event.target.value })} />
        <Field type="color" label="Cristal" value={config.glassColor || '#ffffff'} onChange={(event) => update({ glassColor: event.target.value })} />
      </div>
      <label className="banner-template-field"><span>Oscurecer imagen: {config.overlayOpacity ?? 38}%</span><input type="range" min="0" max="70" value={config.overlayOpacity ?? 38} onChange={(event) => update({ overlayOpacity: Number(event.target.value) })} /></label>
    </div>}
  </div>;
}
