import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import './manualOrderModal.css';

const initialCustomer = {
  name: '', lastname: '', id: '', emailOrPhone: '',
  phone: '', email: '', deliveryType: 'retiro',
  address: '', city: '', country: 'Colombia',
};
const initialBilling = {
  documentType: 'CC', email: '', address: '', department: '',
  departmentCode: '', city: '', municipalityCode: '',
  country: 'Colombia', countryCode: 'CO',
};

function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function money(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ManualOrderModal({ open, onClose, onCreated }) {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer);
  const [billing, setBilling] = useState(initialBilling);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const latestModalState = useRef({ loading, onClose });
  latestModalState.current = { loading, onClose };

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector('[aria-label="Cerrar"]')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !latestModalState.current.loading) {
        event.preventDefault();
        latestModalState.current.onClose();
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    api.get('/api/orders/admin/manual/branches').then(({ data }) => {
      if (!active) return;
      setBranches(data.branches || []);
      setBranchId((current) => current || data.branches?.[0]?._id || '');
    }).catch((reason) => {
      if (active) setError(errorMessage(reason, 'No se pudieron cargar las sedes.'));
    });
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open || created) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      api.get('/api/orders/admin/manual/products', { params: { q: search } })
        .then(({ data }) => { if (active) setProducts(data.products || []); })
        .catch((reason) => {
          if (active) setError(errorMessage(reason, 'No se pudieron cargar los productos.'));
        });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [open, search, created]);

  useEffect(() => {
    if (!open || created) return undefined;
    let active = true;
    api.get('/api/geo/regions', { params: { country: 'CO' } })
      .then(({ data }) => { if (active) setRegions(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('No se pudieron cargar los departamentos fiscales. Intenta nuevamente.'); });
    return () => { active = false; };
  }, [open, created]);

  useEffect(() => {
    if (!open || !billing.departmentCode || created) {
      setCities([]);
      return undefined;
    }
    let active = true;
    setGeoLoading(true);
    api.get('/api/geo/cities', { params: { country: 'CO', region: billing.departmentCode, limit: 10000 } })
      .then(({ data }) => { if (active) setCities(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setError('No se pudieron cargar los municipios fiscales. Intenta nuevamente.'); })
      .finally(() => { if (active) setGeoLoading(false); });
    return () => { active = false; };
  }, [open, billing.departmentCode, created]);

  if (!open) return null;

  function invalidate() {
    setPreview(null);
    setError('');
    setRequestId(crypto.randomUUID());
  }

  function addItem(product, variant = null) {
    const next = {
      productId: product._id,
      variantKey: variant?.variantKey || '',
      variantAttributes: variant?.attributes || [],
      size: variant?.size || '',
      color: variant?.color || '',
      title: product.title,
      label: variant?.label || '',
      price: variant?.price ?? product.price,
      quantity: 1,
    };
    setItems((current) => {
      const index = current.findIndex((item) => item.productId === next.productId && item.variantKey === next.variantKey);
      if (index < 0) return [...current, next];
      return current.map((item, position) => position === index
        ? { ...item, quantity: item.quantity + 1 } : item);
    });
    invalidate();
  }

  function changeItem(index, quantity) {
    setItems((current) => current.map((item, position) => position === index
      ? { ...item, quantity: Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1))) }
      : item));
    invalidate();
  }

  function payload() {
    return {
      branchId,
      customer: { ...customer, email: customer.email || billing.email },
      billing: {
        ...billing,
        useSameAddress: false,
        personType: 'natural',
        firstName: customer.name,
        lastName: customer.lastname,
        documentNumber: customer.id,
      },
      items: items.map(({ productId, variantKey, variantAttributes, size, color, quantity }) => ({
        productId, variantKey, variantAttributes, size, color, quantity,
      })),
    };
  }

  async function handlePreview(event) {
    event.preventDefault();
    setError('');
    if (!branchId || !items.length) {
      setError('Selecciona una sede y añade al menos un producto.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/orders/admin/manual/quote', payload());
      setPreview({ ...data.pricing, reservationRequired: data.reservationRequired === true });
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo calcular el pedido.'));
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/api/orders/admin/manual', {
        ...payload(), requestId,
      });
      setCreated(data.order);
      onCreated(data.order);
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudo crear el pedido.'));
    } finally { setLoading(false); }
  }

  return createPortal(
    <div className="manual-order-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section ref={dialogRef} className="manual-order-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
        <header className="manual-order-header">
          <div>
            <span className="manual-order-eyebrow">Órdenes · Encargos</span>
            <h2 id="manual-order-title">{created ? 'Pedido creado' : 'Pedido pendiente de pago'}</h2>
            <p>{created ? 'El pedido quedó guardado en Órdenes.' : 'Registra un encargo recibido por teléfono o mensaje. El cobro se confirma después en el detalle.'}</p>
          </div>
          <button type="button" className="manual-order-close" onClick={onClose} disabled={loading} aria-label="Cerrar">×</button>
        </header>

        {created ? (
          <div className="manual-order-success" role="status">
            <strong>Pedido #{created.orderNumber}</strong>
            <p>Total: {money(created.total)} · Pago pendiente de confirmación.</p>
            {created.reservationExpiresAt && <p>Reserva de inventario hasta las {new Date(created.reservationExpiresAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}. Si no se confirma el pago antes, el pedido vence y el inventario se libera.</p>}
            <button type="button" className="manual-order-primary" onClick={() => {
              onClose();
              window.location.assign(`/admin/ordenes?openOrder=${created._id}`);
            }}>Ver pedido</button>
          </div>
        ) : (
          <form onSubmit={handlePreview}>
            {error && <div className="manual-order-error" role="alert">{error}</div>}
            <fieldset className="manual-order-body" disabled={loading}>
              <div className="manual-order-panel">
                <label>Sede
                  <select required value={branchId} onChange={(event) => { setBranchId(event.target.value); invalidate(); }}>
                    <option value="">Selecciona una sede</option>
                    {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} · {branch.code}</option>)}
                  </select>
                </label>
                {!branches.length && <p className="manual-order-hint">No hay sedes activas habilitadas para pedidos pendientes de pago.</p>}
                <label>Buscar producto
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, SKU o código de barras" />
                </label>
                <div className="manual-order-products" aria-label="Productos disponibles">
                  {products.map((product) => (product.variants.length ? product.variants : [null]).map((variant) => (
                    <button type="button" key={`${product._id}:${variant?.variantKey || 'base'}`}
                      onClick={() => addItem(product, variant)}>
                      <span><strong>{product.title}</strong>{variant && <small>{variant.label}</small>}</span>
                      <span>{money(variant?.price ?? product.price)} <b>＋</b></span>
                    </button>
                  )))}
                  {!products.length && <p className="manual-order-hint">No hay productos para esta búsqueda.</p>}
                </div>
              </div>
              <div className="manual-order-panel">
                <h3>Productos del pedido</h3>
                {!items.length && <p className="manual-order-hint">Añade productos desde la lista.</p>}
                {items.map((item, index) => (
                  <div className="manual-order-line" key={`${item.productId}:${item.variantKey}`}>
                    <div><strong>{item.title}</strong><small>{item.label} · {money(item.price)} c/u</small></div>
                    <input aria-label={`Cantidad de ${item.title}`} type="number" min="1" max="999" value={item.quantity} onChange={(event) => changeItem(index, event.target.value)} />
                    <button type="button" onClick={() => { setItems((current) => current.filter((_, position) => position !== index)); invalidate(); }} aria-label={`Quitar ${item.title}`}>×</button>
                  </div>
                ))}
                <h3>Cliente</h3>
                <div className="manual-order-fields">
                  {[['name', 'Nombre'], ['lastname', 'Apellido'], ['id', 'Documento'], ['emailOrPhone', 'Correo o teléfono']].map(([key, label]) => (
                    <label key={key}>{label}<input required value={customer[key]} onChange={(event) => { setCustomer((current) => ({ ...current, [key]: event.target.value })); invalidate(); }} /></label>
                  ))}
                  <label>Entrega
                    <select value={customer.deliveryType} onChange={(event) => { setCustomer((current) => ({ ...current, deliveryType: event.target.value })); invalidate(); }}>
                      <option value="retiro">Retiro en sede</option><option value="envio">Envío</option>
                    </select>
                  </label>
                  {customer.deliveryType === 'envio' && <>
                    <label>Dirección<input required value={customer.address} onChange={(event) => { setCustomer((current) => ({ ...current, address: event.target.value })); invalidate(); }} /></label>
                    <label>Ciudad<input required value={customer.city} onChange={(event) => { setCustomer((current) => ({ ...current, city: event.target.value })); invalidate(); }} /></label>
                    <label>País<input required value={customer.country} onChange={(event) => { setCustomer((current) => ({ ...current, country: event.target.value })); invalidate(); }} /></label>
                  </>}
                </div>
                <p className="manual-order-hint">El correo fiscal también servirá para la entrega electrónica de productos digitales o servicios.</p>
                <h3>Datos para factura electrónica</h3>
                <p className="manual-order-hint">Registra estos datos antes de crear el pedido para que la factura se emita al confirmar el pago.</p>
                <div className="manual-order-fields">
                  <label>Tipo de documento fiscal
                    <select required value={billing.documentType} onChange={(event) => { setBilling((current) => ({ ...current, documentType: event.target.value })); invalidate(); }}>
                      <option value="CC">Cédula de ciudadanía</option>
                      <option value="CE">Cédula de extranjería</option>
                      <option value="TI">Tarjeta de identidad</option>
                      <option value="PP">Pasaporte</option>
                      <option value="PPT">Permiso de protección temporal</option>
                    </select>
                  </label>
                  <label>Correo fiscal
                    <input type="email" required value={billing.email} onChange={(event) => { setBilling((current) => ({ ...current, email: event.target.value })); invalidate(); }} />
                  </label>
                  <label>Dirección fiscal
                    <input required value={billing.address} onChange={(event) => { setBilling((current) => ({ ...current, address: event.target.value })); invalidate(); }} />
                  </label>
                  <label>Departamento fiscal
                    <select required value={billing.departmentCode} onChange={(event) => {
                      const region = regions.find((item) => String(item.code) === event.target.value);
                      setBilling((current) => ({ ...current, departmentCode: event.target.value, department: region?.name || '', city: '', municipalityCode: '' }));
                      setCities([]);
                      invalidate();
                    }}>
                      <option value="">Selecciona departamento</option>
                      {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
                    </select>
                  </label>
                  <label>Municipio fiscal
                    <select required disabled={!billing.departmentCode || geoLoading} value={billing.municipalityCode} onChange={(event) => {
                      const city = cities.find((item) => String(item.code) === event.target.value);
                      setBilling((current) => ({ ...current, municipalityCode: event.target.value, city: city?.name || '' }));
                      invalidate();
                    }}>
                      <option value="">{geoLoading ? 'Cargando municipios…' : 'Selecciona municipio'}</option>
                      {cities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </fieldset>
            <footer className="manual-order-footer">
              <p className="manual-order-policy">{preview?.reservationRequired
                ? 'Este pedido reservará inventario durante 20 minutos. Si no se confirma el pago, vencerá y liberará los productos.'
                : 'Los productos que manejan inventario se reservan durante 20 minutos al crear el pedido.'} Confirma el pago solo cuando compruebes que lo recibiste.</p>
              {preview && <div className="manual-order-pricing">
                <span>Subtotal {money(preview.subtotal)} · IVA {money(preview.tax?.amount)} · Envío {money(preview.shipping)}</span>
                <strong>Total {money(preview.total)}</strong>
              </div>}
              <button type="button" className="manual-order-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
              {preview
                ? <button type="button" className="manual-order-primary" onClick={handleCreate} disabled={loading}>{loading ? 'Guardando…' : 'Crear pedido pendiente de pago'}</button>
                : <button type="submit" className="manual-order-primary" disabled={loading || !branches.length}>{loading ? 'Calculando…' : 'Revisar total'}</button>}
            </footer>
          </form>
        )}
      </section>
    </div>, document.body
  );
}
