import { Search } from 'lucide-react';

import {
  OrdersFilterField,
  ordersFilterInputStyle,
} from './OrdersFilterUi';

export default function OrdersSearchDateFields({
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  setPage,
  setTypingQ,
  typingQ,
}) {
  return (
    <>
      <OrdersFilterField className="orf-col-4 orf-sidebar-wide" label="Buscar" gridColumn="span 4">
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            strokeWidth={2}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--admin-card-muted-text)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="orf-input orf-field"
            placeholder="Buscar orden, cliente o email..."
            value={typingQ}
            onChange={(event) => {
              setTypingQ(event.target.value);
              setPage(1);
            }}
            style={ordersFilterInputStyle({ paddingLeft: 38 })}
          />
        </div>
      </OrdersFilterField>

      <OrdersFilterField className="orf-col-2" label="Desde" gridColumn="span 2">
        <input
          type="date"
          className="orf-field"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          style={ordersFilterInputStyle()}
        />
      </OrdersFilterField>

      <OrdersFilterField className="orf-col-2" label="Hasta" gridColumn="span 2">
        <input
          type="date"
          className="orf-field"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          style={ordersFilterInputStyle()}
        />
      </OrdersFilterField>
    </>
  );
}
