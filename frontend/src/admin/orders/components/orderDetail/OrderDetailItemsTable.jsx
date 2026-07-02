// frontend/src/admin/orders/components/orderDetail/OrderDetailItemsTable.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  cleanText,
  getItemPrice,
  getItemQuantity,
  getOrderItems,
  toCOP,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  EmptyState,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

function getProductTitle(item) {
  return (
    item?.title ||
    item?.name ||
    item?.productName ||
    item?.product?.title ||
    item?.product?.name ||
    'Producto sin nombre'
  );
}

function getProductImage(item) {
  return (
    item?.image ||
    item?.imageUrl ||
    item?.productImage ||
    item?.product?.image ||
    item?.product?.imageUrl ||
    ''
  );
}

function getProductSku(item) {
  return (
    item?.sku ||
    item?.SKU ||
    item?.product?.sku ||
    item?.product?.SKU ||
    '—'
  );
}

function getProductColor(item) {
  return (
    item?.colorName ||
    item?.colorLabel ||
    item?.color ||
    item?.selectedColor ||
    '—'
  );
}

function getProductSize(item) {
  return (
    item?.size ||
    item?.talla ||
    item?.selectedSize ||
    item?.variant?.size ||
    '—'
  );
}

export default function OrderDetailItemsTable({ order }) {
  const items = getOrderItems(order);

  return (
    <OrderDetailPanel
      style={{
        padding: 18,
      }}
    >
      <SectionTitle
        icon={OrderDetailIcons.ShoppingBag}
        title="Productos de la orden"
        subtitle="Detalle de prendas, cantidades, variantes y subtotales"
        action={
          <SoftBadge variant="neutral">
            {items.length} producto(s)
          </SoftBadge>
        }
      />

      {items.length === 0 ? (
        <EmptyState>No hay productos registrados en esta orden.</EmptyState>
      ) : (
        <div
          style={{
            width: '100%',
            overflowX: 'auto',
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            borderRadius: 20,
            background: ORDER_DETAIL_THEME.inputBg,
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: 760,
              borderCollapse: 'collapse',
              color: ORDER_DETAIL_THEME.cardText,
            }}
          >
            <thead>
              <tr
                style={{
                  background: ORDER_DETAIL_THEME.primarySoftBg,
                  borderBottom: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                }}
              >
                <Th>Producto</Th>
                <Th>SKU</Th>
                <Th>Talla</Th>
                <Th>Color</Th>
                <Th align="center">Cant.</Th>
                <Th align="right">Precio</Th>
                <Th align="right">Subtotal</Th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => {
                const title = getProductTitle(item);
                const image = getProductImage(item);
                const sku = getProductSku(item);
                const size = getProductSize(item);
                const color = getProductColor(item);
                const quantity = getItemQuantity(item);
                const price = getItemPrice(item);
                const subtotal = quantity * price;

                return (
                  <tr
                    key={item?._id || item?.id || `${title}-${index}`}
                    style={{
                      borderBottom:
                        index === items.length - 1
                          ? 'none'
                          : `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                      background:
                        index % 2 === 0
                          ? ORDER_DETAIL_THEME.cardBg
                          : ORDER_DETAIL_THEME.inputBg,
                    }}
                  >
                    <Td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 54,
                            height: 64,
                            minWidth: 54,
                            borderRadius: 16,
                            overflow: 'hidden',
                            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                            background: ORDER_DETAIL_THEME.primarySoftBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {image ? (
                            <img
                              src={image}
                              alt={title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <OrderDetailIcons.ShoppingBag
                              size={20}
                              strokeWidth={2.2}
                              color={ORDER_DETAIL_THEME.primary}
                            />
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <strong
                            title={title}
                            style={{
                              display: 'block',
                              color: ORDER_DETAIL_THEME.cardText,
                              fontSize: 13,
                              fontWeight: 900,
                              lineHeight: 1.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 260,
                            }}
                          >
                            {title}
                          </strong>

                          <span
                            style={{
                              display: 'block',
                              marginTop: 4,
                              color: ORDER_DETAIL_THEME.mutedText,
                              fontSize: 11,
                              fontWeight: 650,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 260,
                            }}
                          >
                            {cleanText(item?.category || item?.product?.category || 'Producto')}
                          </span>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <CodeText>{sku}</CodeText>
                    </Td>

                    <Td>
                      <SoftBadge variant="neutral">{size}</SoftBadge>
                    </Td>

                    <Td>
                      <ColorValue value={color} />
                    </Td>

                    <Td align="center">
                      <strong
                        style={{
                          color: ORDER_DETAIL_THEME.cardText,
                          fontWeight: 900,
                        }}
                      >
                        {quantity}
                      </strong>
                    </Td>

                    <Td align="right">
                      <strong
                        style={{
                          color: ORDER_DETAIL_THEME.cardText,
                          fontWeight: 850,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {toCOP(price)}
                      </strong>
                    </Td>

                    <Td align="right">
                      <strong
                        style={{
                          color: ORDER_DETAIL_THEME.primary,
                          fontWeight: 950,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {toCOP(subtotal)}
                      </strong>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </OrderDetailPanel>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th
      style={{
        padding: '13px 14px',
        textAlign: align,
        color: ORDER_DETAIL_THEME.mutedText,
        fontSize: 10,
        fontWeight: 950,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }) {
  return (
    <td
      style={{
        padding: '13px 14px',
        textAlign: align,
        verticalAlign: 'middle',
        color: ORDER_DETAIL_THEME.cardText,
        fontSize: 13,
      }}
    >
      {children}
    </td>
  );
}

function CodeText({ children }) {
  return (
    <span
      title={String(children || '')}
      style={{
        display: 'inline-flex',
        maxWidth: 120,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: ORDER_DETAIL_THEME.primary,
        background: ORDER_DETAIL_THEME.primarySoftBg,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 999,
        padding: '6px 9px',
        fontSize: 11,
        fontWeight: 900,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {children || '—'}
    </span>
  );
}

function ColorValue({ value }) {
  const colorText = cleanText(value);

  const isHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || ''));

  return (
    <span
      title={colorText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        color: ORDER_DETAIL_THEME.cardText,
        fontSize: 12,
        fontWeight: 800,
        maxWidth: 130,
      }}
    >
      <span
        style={{
          width: 13,
          height: 13,
          minWidth: 13,
          borderRadius: 999,
          border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
          background: isHexColor ? value : ORDER_DETAIL_THEME.primarySoftBg,
        }}
      />

      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {colorText}
      </span>
    </span>
  );
}