import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../lib/api';
import './manualOrderModal.css';

const initialCustomer = {
  name: '', lastname: '', id: '', emailOrPhone: '',
  phone: '', email: '', deliveryType: 'retiro',
  address: '', city: '', country: 'Colombia',
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
  const [preview, setPreview] = useState(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      customer,
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
      setPreview(data.pricing);
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
      <section className="manual-order-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-order-title">
        <header className="manual-order-header">
          <div>
            <span className="manual-order-eyebrow">Órdenes · Gestión de sedes</span>
            <h2 id="manual-order-title">{created ? 'Pedido creado' : 'Nuevo pedido manual'}</h2>
            <p>{created ? 'Ya está guardado en el historial.' : 'Selecciona sede, productos y datos del cliente.'}</p>
          </div>
          <button type="button" className="manual-order-close" onClick={onClose} disabled={loading} aria-label="Cerrar">×</button>
        </header>

        {created ? (
          <div className="manual-order-success" role="status">
            <strong>Pedido #{created.orderNumber}</strong>
            <p>Total: {money(created.total)} · Pago pendiente de confirmación.</p>
            {created.reservationExpiresAt && <p>El inventario se reserva durante 20 minutos. Confirma el pago desde el detalle antes de que venza.</p>}
            <button type="button" className="manual-order-primary" onClick={() => {
              onClose();
              window.location.assign(`/admin/ordenes?openOrder=${created._id}`);
            }}>Ver pedido</button>
          </div>
        ) : (
          <form onSubmit={handlePreview}>
            {error && <div className="manual-order-error" role="alert">{error}</div>}
            <div className="manual-order-body">
              <div className="manual-order-panel">
                <label>Sede
                  <select required value={branchId} onChange={(event) => { setBranchId(event.target.value); invalidate(); }}>
                    <option value="">Selecciona una sede</option>
                    {branches.map((branch) => <option key={branch._id} value={branch._id}>{branch.name} · {branch.code}</option>)}
                  </select>
                </label>
                {!branches.length && <p className="manual-order-hint">No hay sedes activas que permitan pedidos manuales para tu usuario.</p>}
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
                <p className="manual-order-hint">Para productos digitales o servicios, escribe un correo válido en “Correo o teléfono”.</p>
              </div>
            </div>
            <footer className="manual-order-footer">
              {preview && <div className="manual-order-pricing">
                <span>Subtotal {money(preview.subtotal)} · IVA {money(preview.tax?.amount)} · Envío {money(preview.shipping)}</span>
                <strong>Total {money(preview.total)}</strong>
              </div>}
              <button type="button" className="manual-order-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
              {preview
                ? <button type="button" className="manual-order-primary" onClick={handleCreate} disabled={loading}>{loading ? 'Guardando…' : 'Crear pedido con pago pendiente'}</button>
                : <button type="submit" className="manual-order-primary" disabled={loading || !branches.length}>{loading ? 'Calculando…' : 'Revisar total'}</button>}
            </footer>
          </form>
        )}
      </section>
    </div>, document.body
  );
}
