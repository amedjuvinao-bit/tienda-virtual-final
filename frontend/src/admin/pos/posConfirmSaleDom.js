// frontend/src/admin/pos/posConfirmSaleDom.js

import { createPosSale, getPosProducts } from '../api/adminPosApi';

const textOf = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function findButton() {
  return Array.from(document.querySelectorAll('button')).find((button) =>
    textOf(button.textContent).includes('Confirmar venta')
  );
}

function selectors() {
  const list = Array.from(document.querySelectorAll('select'));
  return {
    branchId: list[0]?.value || '',
    paymentMethod: list[1]?.value || 'cash',
  };
}

function qtyFor(product) {
  const title = textOf(product.title);
  if (!title) return 0;

  const row = Array.from(document.querySelectorAll('div')).find((node) => {
    const text = textOf(node.textContent);
    return text.includes(title) && text.includes('En carrito:');
  });

  const match = row ? textOf(row.textContent).match(/En carrito:\s*(\d+)/i) : null;
  return match ? Math.max(0, Number(match[1] || 0)) : 0;
}

export function attachPosConfirmController() {
  let stopped = false;
  const state = {
    branchId: '',
    products: [],
    loading: false,
    saving: false,
  };

  const loadProducts = async () => {
    const { branchId } = selectors();
    if (!branchId || state.loading) return;
    if (state.branchId === branchId && state.products.length > 0) return;

    state.loading = true;
    try {
      const data = await getPosProducts({ branchId, q: '', limit: 60 });
      state.branchId = branchId;
      state.products = Array.isArray(data?.products) ? data.products : [];
    } catch {
      state.products = [];
    } finally {
      state.loading = false;
    }
  };

  const cartItems = () => state.products
    .map((product) => ({ product, quantity: qtyFor(product) }))
    .filter((item) => item.quantity > 0);

  const refreshButton = () => {
    const button = findButton();
    if (!button) return;

    const enabled = cartItems().length > 0 && !state.saving;
    button.disabled = !enabled;
    button.title = enabled ? 'Crear venta POS real' : 'Agrega productos al carrito para confirmar la venta';

    if (!button.dataset.posSaleReady) {
      button.dataset.posSaleReady = '1';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (state.saving) return;
        await loadProducts();

        const { branchId, paymentMethod } = selectors();
        const selected = cartItems();
        if (!branchId || selected.length === 0) return;

        const total = selected.reduce((sum, item) => (
          sum + Number(item.product.price || 0) * Number(item.quantity || 1)
        ), 0);

        try {
          state.saving = true;
          refreshButton();

          const data = await createPosSale({
            branchId,
            customerMode: 'guest',
            registerCode: 'CAJA POS',
            items: selected.map(({ product, quantity }) => ({
              productId: product.productId,
              quantity,
              size: product.size || '',
              color: product.color || '',
            })),
            payment: {
              method: paymentMethod,
              receivedAmount: total,
              amount: total,
            },
            discount: { type: 'none', value: 0 },
          });

          const number = data?.order?.orderNumber || data?.order?.number || '';
          window.alert(number ? `Venta creada. Orden ${number}.` : 'Venta creada correctamente.');
          window.location.reload();
        } catch (error) {
          window.alert(error?.message || 'No fue posible confirmar la venta POS.');
        } finally {
          state.saving = false;
          refreshButton();
        }
      }, true);
    }
  };

  const timer = window.setInterval(() => {
    if (stopped) return;
    loadProducts();
    refreshButton();
  }, 350);

  const observer = new MutationObserver(() => {
    if (stopped) return;
    loadProducts();
    refreshButton();
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  return () => {
    stopped = true;
    window.clearInterval(timer);
    observer.disconnect();
  };
}
