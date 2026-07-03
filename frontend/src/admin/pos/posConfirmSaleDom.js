// frontend/src/admin/pos/posConfirmSaleDom.js

import { createPosSale, getPosProducts } from '../api/adminPosApi';

const textOf = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function findButton() {
  return Array.from(document.querySelectorAll('button')).find((button) =>
    textOf(button.textContent).includes('Confirmar venta') ||
    textOf(button.textContent).includes('Creando venta')
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

function showPosMessage(message, type = 'success') {
  const old = document.querySelector('[data-pos-sale-message="1"]');
  if (old) old.remove();

  const box = document.createElement('div');
  box.dataset.posSaleMessage = '1';
  box.textContent = message;
  box.style.border = type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0';
  box.style.background = type === 'error' ? '#fef2f2' : '#ecfdf5';
  box.style.color = type === 'error' ? '#b91c1c' : '#047857';
  box.style.padding = '14px 16px';
  box.style.borderRadius = '18px';
  box.style.fontSize = '14px';
  box.style.fontWeight = '900';
  box.style.marginBottom = '16px';

  const title = Array.from(document.querySelectorAll('h1')).find((node) =>
    textOf(node.textContent).includes('POS / Ventas físicas')
  );
  const container = title?.closest('.space-y-5') || document.querySelector('main') || document.body;

  container.insertBefore(box, container.firstChild);

  window.setTimeout(() => {
    if (box.isConnected) box.remove();
  }, 9000);
}

function clearCart() {
  const emptyButton = Array.from(document.querySelectorAll('button')).find((button) =>
    textOf(button.textContent) === 'Vaciar'
  );

  if (emptyButton) emptyButton.click();
}

function updateProductStockOnScreen(items) {
  items.forEach(({ product, quantity }) => {
    const nextStock = Math.max(0, Number(product.availableStock || 0) - Number(quantity || 0));
    product.availableStock = nextStock;
    product.stock = nextStock;

    const title = textOf(product.title);
    if (!title) return;

    const rows = Array.from(document.querySelectorAll('div')).filter((node) => {
      const text = textOf(node.textContent);
      return text.includes(title) && text.includes('Agregar') && text.includes('Stock:');
    });

    rows.forEach((row) => {
      const stockLabel = Array.from(row.querySelectorAll('span')).find((span) =>
        textOf(span.textContent).startsWith('Stock:')
      );

      if (stockLabel) stockLabel.textContent = `Stock: ${nextStock}`;
    });
  });
}

export function attachPosConfirmController() {
  let stopped = false;
  const state = {
    branchId: '',
    products: [],
    loading: false,
    saving: false,
  };

  const loadProducts = async (force = false) => {
    const { branchId } = selectors();
    if (!branchId || state.loading) return;
    if (!force && state.branchId === branchId && state.products.length > 0) return;

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
    button.style.opacity = enabled ? '1' : '0.6';
    button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    button.style.background = 'var(--admin-primary)';
    button.style.color = '#fff';

    if (state.saving) button.textContent = 'Creando venta...';
    if (!state.saving && textOf(button.textContent).includes('Creando venta')) button.textContent = 'Confirmar venta';

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
          updateProductStockOnScreen(selected);
          clearCart();
          showPosMessage(number ? `Venta POS creada correctamente. Orden ${number}.` : 'Venta POS creada correctamente.');
          await loadProducts(true);
        } catch (error) {
          showPosMessage(error?.message || 'No fue posible confirmar la venta POS.', 'error');
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
