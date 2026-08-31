import { Building2 } from 'lucide-react';

import {
  OrdersFilterField,
  ordersFilterInputStyle,
  ordersFilterSelectStyle,
} from './OrdersFilterUi';
import { getBranchLabel, getBranchValue } from './ordersFiltersModel';

export function OrdersStatusField({
  onStatusChange,
  statusFilter,
  statusFilters,
}) {
  const currentStatus = statusFilter.length === 1 ? statusFilter[0] : 'all';

  return (
    <OrdersFilterField className="orf-col-4 orf-sidebar-wide" label="Estado" gridColumn="span 4">
      <select
        className="orf-select orf-field"
        value={currentStatus}
        onChange={(event) => onStatusChange(event.target.value)}
        style={ordersFilterSelectStyle()}
      >
        <option value="all">
          {statusFilter.length > 1 ? 'Varios estados' : 'Todos los estados'}
        </option>
        {statusFilters.map((status) => (
          <option key={status.key} value={status.key}>
            {status.label}
          </option>
        ))}
      </select>
    </OrdersFilterField>
  );
}

export function OrdersBranchField({
  branchId,
  branches,
  onBranchChange,
}) {
  return (
    <OrdersFilterField className="orf-col-6" label="Sede" gridColumn="span 6">
      <div style={{ position: 'relative' }}>
        <Building2
          size={15}
          strokeWidth={2}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--admin-card-muted-text)',
            pointerEvents: 'none',
          }}
        />
        <select
          className="orf-select orf-field"
          value={branchId || ''}
          onChange={(event) => onBranchChange(event.target.value)}
          style={ordersFilterSelectStyle({ paddingLeft: 34 })}
        >
          <option value="">Todas las sedes</option>
          {branches.map((branch) => {
            const value = getBranchValue(branch);
            if (!value) return null;
            return (
              <option key={value} value={value}>
                {getBranchLabel(branch)}
              </option>
            );
          })}
        </select>
      </div>
    </OrdersFilterField>
  );
}

export function OrdersTagsFields({
  setPage,
  setTagsMode,
  setTagsStr,
  tagsMode,
  tagsStr,
}) {
  return (
    <>
      <OrdersFilterField className="orf-col-6" label="Tags" gridColumn="span 6">
        <input
          className="orf-input orf-field"
          placeholder="vip, urgente, mayorista..."
          value={tagsStr}
          onChange={(event) => {
            setTagsStr(event.target.value);
            setPage(1);
          }}
          style={ordersFilterInputStyle()}
        />
      </OrdersFilterField>

      <OrdersFilterField className="orf-col-3" label="Modo tags" gridColumn="span 3">
        <select
          className="orf-select orf-field"
          value={tagsMode}
          onChange={(event) => {
            setTagsMode(event.target.value === 'all' ? 'all' : 'any');
            setPage(1);
          }}
          style={ordersFilterSelectStyle()}
        >
          <option value="any">Cualquier tag</option>
          <option value="all">Todos los tags</option>
        </select>
      </OrdersFilterField>
    </>
  );
}
