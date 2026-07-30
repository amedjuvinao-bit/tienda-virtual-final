export default function OrdersTable({
  ADMIN_BORDER,

  data,
  loading,
  selectedIds,

  toggleSelectAllVisible,
  toggleOne,
  isSelected,

  toggleSort,
  sortAria,
  sortIcon,

  fmtDate,
  toCOP,
  statusBadgeClasses,

  openOrderDetail,
}) {
  const THEME = {
    cardBg: 'var(--admin-card-bg)',
    cardText: 'var(--admin-card-text)',
    mutedText: 'var(--admin-card-muted-text)',
    primary: 'var(--admin-primary)',
    primaryHover: 'var(--admin-primary-hover)',
    primarySoftBg: 'var(--admin-primary-soft-bg)',
    primarySoftText: 'var(--admin-button-soft-text)',
    inputBg: 'var(--admin-input-bg)',
    cardBorder: 'var(--admin-card-border)',
  };

  const getStatusAccent = (status) => {
    const normalized = String(status || '').toLowerCase();

    if (normalized.includes('paid') || normalized.includes('pag')) return 'from-emerald-400 to-green-500';
    if (normalized.includes('pending') || normalized.includes('pend')) return 'from-amber-300 to-yellow-500';
    if (normalized.includes('fail') || normalized.includes('fall')) return 'from-rose-400 to-red-500';
    if (normalized.includes('cancel')) return 'from-gray-300 to-gray-500';
    if (normalized.includes('refund') || normalized.includes('reemb')) return 'from-violet-400 to-purple-500';
    if (normalized.includes('sent') || normalized.includes('env')) return 'from-sky-400 to-blue-500';

    return 'from-pink-300 to-pink-500';
  };

  const getOrderLevel = (total) => {
    const value = Number(total || 0);

    if (value >= 700000) return 'Ticket alto';
    if (value >= 250000) return 'Ticket medio';
    return 'Orden estándar';
  };

  const getBranchInfo = (order) => {
    const branchSnapshot = order?.branchSnapshot || {};
    const branch = order?.branch || {};
    const allocations = Array.isArray(order?.inventoryAllocations)
      ? order.inventoryAllocations
      : [];
    const allocationBranches = [];
    const seen = new Set();

    allocations.forEach((allocation) => {
      const snapshot = allocation?.branchSnapshot || {};
      const allocationBranch = allocation?.branch || {};
      const id = String(
        allocationBranch?._id ||
          allocationBranch?.id ||
          allocationBranch ||
          snapshot.code ||
          snapshot.name ||
          ''
      );
      if (!id || seen.has(id)) return;
      seen.add(id);
      allocationBranches.push({
        name: String(
          snapshot.name || allocationBranch?.name || 'Sede sin nombre'
        ).trim(),
        code: String(
          snapshot.code || allocationBranch?.code || ''
        )
          .trim()
          .toUpperCase(),
      });
    });

    const name =
      branchSnapshot.name ||
      branch.name ||
      order?.branchName ||
      order?.branch_label ||
      '';

    const code =
      branchSnapshot.code ||
      branch.code ||
      order?.branchCode ||
      '';

    const type =
      branchSnapshot.type ||
      branch.type ||
      '';

    const isMultiBranch = allocationBranches.length > 1;
    const singleAllocationBranch =
      allocationBranches.length === 1
        ? allocationBranches[0]
        : null;

    return {
      name: isMultiBranch
        ? `${allocationBranches.length} sedes de despacho`
        : singleAllocationBranch?.name ||
          String(name || '').trim() ||
          'Sin sede',
      code: isMultiBranch
        ? allocationBranches
            .map((item) => item.code)
            .filter(Boolean)
            .join(' + ')
        : singleAllocationBranch?.code ||
          String(code || '').trim().toUpperCase(),
      type: String(type || '').trim().toLowerCase(),
      hasBranch: Boolean(
        allocationBranches.length || name || code
      ),
      isMultiBranch,
      branches: allocationBranches,
    };
  };

  const getOrderOriginInfo = (order) => {
    const source = String(order?.source || '').trim().toLowerCase();
    const channel = String(order?.channel || '').trim().toLowerCase();
    const saleType = String(order?.saleType || '').trim().toLowerCase();
    const paymentProvider = String(order?.payment?.provider || '').trim().toLowerCase();
    const pos = order?.pos || {};

    const isPos =
      source === 'pos' ||
      channel === 'physical_store' ||
      saleType === 'pos_sale' ||
      paymentProvider === 'pos' ||
      Boolean(pos.receiptNumber || pos.saleNumber || pos.registerCode);

    if (isPos) {
      const reference = pos.receiptNumber || pos.saleNumber || order?.payment?.reference || '';
      const terminal = pos.registerCode || pos.terminalId || '';

      return {
        label: 'POS',
        description: 'Venta física',
        detail: [reference, terminal ? `Caja ${terminal}` : 'Caja'].filter(Boolean).join(' · '),
        badgeBg: 'linear-gradient(135deg, color-mix(in srgb, #22c55e 18%, #ffffff), color-mix(in srgb, var(--admin-primary-soft-bg) 65%, #ffffff))',
        badgeText: '#047857',
        border: 'color-mix(in srgb, #22c55e 42%, var(--admin-card-border))',
      };
    }

    if (source === 'manual' || saleType === 'manual_order') {
      return {
        label: 'MANUAL',
        description: 'Orden manual',
        detail: 'Creada desde administración',
        badgeBg: 'color-mix(in srgb, #f59e0b 14%, var(--admin-input-bg))',
        badgeText: '#92400e',
        border: 'color-mix(in srgb, #f59e0b 38%, var(--admin-card-border))',
      };
    }

    if (source === 'admin') {
      return {
        label: 'ADMIN',
        description: 'Panel administrativo',
        detail: 'Gestión interna',
        badgeBg: 'color-mix(in srgb, var(--admin-primary) 12%, var(--admin-input-bg))',
        badgeText: 'var(--admin-primary)',
        border: 'color-mix(in srgb, var(--admin-primary) 34%, var(--admin-card-border))',
      };
    }

    if (source === 'import') {
      return {
        label: 'IMPORTADA',
        description: 'Carga externa',
        detail: 'Orden importada',
        badgeBg: 'color-mix(in srgb, #64748b 14%, var(--admin-input-bg))',
        badgeText: '#475569',
        border: 'color-mix(in srgb, #64748b 34%, var(--admin-card-border))',
      };
    }

    return {
      label: 'WEB',
      description: 'Tienda virtual',
      detail: 'Pedido online',
      badgeBg: 'color-mix(in srgb, #38bdf8 14%, var(--admin-input-bg))',
      badgeText: '#0369a1',
      border: 'color-mix(in srgb, #38bdf8 36%, var(--admin-card-border))',
    };
  };

  return (
    <div className="space-y-3">
      <style>{`
        .orders-theme-action-btn,
        .orders-theme-action-btn *,
        .orders-theme-action-btn svg,
        .orders-theme-action-btn svg * {
          color: var(--admin-button-soft-text) !important;
          stroke: var(--admin-button-soft-text) !important;
          fill: none !important;
        }

        .orders-theme-action-btn {
          background: var(--admin-primary-soft-bg) !important;
          border-color: var(--admin-card-border) !important;
        }

        .orders-theme-action-btn:hover,
        .orders-theme-action-btn:hover *,
        .orders-theme-action-btn:hover svg,
        .orders-theme-action-btn:hover svg * {
          color: var(--admin-primary-text) !important;
          stroke: var(--admin-primary-text) !important;
          fill: none !important;
        }

        .orders-theme-action-btn:hover {
          background: var(--admin-primary) !important;
          border-color: var(--admin-primary) !important;
        }
      `}</style>

      <div
        className="overflow-hidden rounded-[28px] border shadow-[0_24px_70px_rgba(236,72,153,0.16)] backdrop-blur"
        style={{
          borderColor: ADMIN_BORDER,
          background: THEME.cardBg,
          color: THEME.cardText,
        }}
      >
        <div
          className="flex flex-col gap-3 border-b px-5 py-5 md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: ADMIN_BORDER,
            background: `linear-gradient(90deg, ${THEME.cardBg}, ${THEME.primarySoftBg}, ${THEME.cardBg})`,
            color: THEME.cardText,
          }}
        >
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ color: THEME.primary }}
            >
              Bandeja operacional
            </div>

            <div className="mt-1 text-xl font-black" style={{ color: THEME.cardText }}>
              Órdenes recientes
            </div>

            <div className="text-xs" style={{ color: THEME.mutedText }}>
              Monitorea ventas, estados, sedes, canal de origen y acciones rápidas.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="orders-theme-action-btn flex h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-bold shadow-sm transition duration-200 hover:-translate-y-0.5">
              <input
                type="checkbox"
                className="accent-pink-600"
                checked={data.length > 0 && data.every((o) => selectedIds.has(o._id))}
                onChange={toggleSelectAllVisible}
              />
              <span>Seleccionar</span>
            </label>

            {[
              ['createdAt', 'Fecha'],
              ['orderNumber', 'Orden'],
              ['total', 'Total'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSort(key)}
                aria-sort={sortAria(key)}
                className="orders-theme-action-btn flex h-10 items-center gap-1 rounded-2xl border px-3 text-[11px] font-black transition duration-200 hover:-translate-y-0.5"
              >
                <span>{label}</span>
                <span className="flex items-center">{sortIcon(key)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`sk-${i}`}
                className="h-32 animate-pulse rounded-[26px] border"
                style={{
                  borderColor: ADMIN_BORDER,
                  background: THEME.primarySoftBg,
                }}
              />
            ))}

          {!loading && data.length === 0 && (
            <div
              className="rounded-[26px] border p-10 text-center text-sm"
              style={{
                borderColor: ADMIN_BORDER,
                background: THEME.cardBg,
                color: THEME.mutedText,
              }}
            >
              Sin resultados
            </div>
          )}

          {!loading &&
            data.map((o) => {
              const cust = o.customer || {};
              const name = [cust.name, cust.lastname].filter(Boolean).join(' ') || 'Cliente';
              const tags = Array.isArray(o.tags) ? o.tags : [];
              const branchInfo = getBranchInfo(o);
              const originInfo = getOrderOriginInfo(o);

              const initials = name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase();

              const orderLevel = getOrderLevel(o.total);

              return (
                <div
                  key={o._id}
                  className="group relative overflow-hidden rounded-[26px] border shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(236,72,153,0.20)]"
                  style={{
                    borderColor: ADMIN_BORDER,
                    background: THEME.cardBg,
                    color: THEME.cardText,
                  }}
                >
                  <div className={`absolute left-0 top-0 h-full w-2 bg-gradient-to-b ${getStatusAccent(o.status)}`} />

                  <div className="grid grid-cols-12 items-stretch">
                    <div
                      className="col-span-12 flex items-center gap-3 border-b px-5 py-5 lg:col-span-4 lg:border-b-0 lg:border-r"
                      style={{ borderColor: ADMIN_BORDER }}
                    >
                      <input
                        type="checkbox"
                        className="accent-pink-600"
                        checked={isSelected(o._id)}
                        onChange={() => toggleOne(o._id)}
                      />

                      <div className="relative">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl text-sm font-black ring-1 shadow-sm"
                          style={{
                            background: THEME.primarySoftBg,
                            color: THEME.primary,
                            borderColor: ADMIN_BORDER,
                          }}
                        >
                          {initials || 'C'}
                        </div>

                        <span
                          className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2"
                          style={{
                            borderColor: THEME.cardBg,
                            background: '#34d399',
                          }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-base font-black" style={{ color: THEME.cardText }}>
                          {name}
                        </div>

                        <div className="mt-0.5 truncate text-[11px]" style={{ color: THEME.mutedText }}>
                          {cust.emailOrPhone || cust.email || 'Sin contacto'}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <span
                            className="inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black"
                            style={{
                              borderColor: originInfo.border,
                              background: originInfo.badgeBg,
                              color: originInfo.badgeText,
                            }}
                            title={originInfo.detail}
                          >
                            {originInfo.label} · {originInfo.description}
                          </span>

                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: THEME.primarySoftBg,
                              color: THEME.primarySoftText,
                            }}
                          >
                            Cliente
                          </span>

                          {cust.phone && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                background: THEME.inputBg,
                                color: THEME.cardText,
                              }}
                            >
                              Teléfono
                            </span>
                          )}

                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: THEME.inputBg,
                              color: THEME.cardText,
                            }}
                          >
                            {orderLevel}
                          </span>

                          <span
                            className="max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-black"
                            style={{
                              borderColor: ADMIN_BORDER,
                              background: branchInfo.hasBranch ? THEME.primarySoftBg : THEME.inputBg,
                              color: branchInfo.hasBranch ? THEME.primarySoftText : THEME.mutedText,
                            }}
                            title={
                              branchInfo.code
                                ? `${branchInfo.name} · ${branchInfo.code}`
                                : branchInfo.name
                            }
                          >
                            {branchInfo.isMultiBranch
                              ? branchInfo.name
                              : `Sede: ${branchInfo.code || branchInfo.name}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="col-span-6 border-b px-5 py-5 sm:col-span-3 lg:col-span-2 lg:border-b-0 lg:border-r"
                      style={{ borderColor: ADMIN_BORDER }}
                    >
                      <div
                        className="text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ color: THEME.mutedText }}
                      >
                        Orden
                      </div>

                      <div className="mt-1 font-mono text-sm font-black" style={{ color: THEME.primary }}>
                        #{o.orderNumber || '—'}
                      </div>

                      <div className="mt-1 text-[11px]" style={{ color: THEME.mutedText }}>
                        {fmtDate(o.createdAt)}
                      </div>

                      <div
                        className="mt-3 rounded-2xl border px-3 py-2"
                        style={{
                          borderColor: originInfo.border,
                          background: originInfo.badgeBg,
                        }}
                      >
                        <div
                          className="text-[9px] font-black uppercase tracking-[0.16em]"
                          style={{ color: originInfo.badgeText }}
                        >
                          Origen
                        </div>

                        <div
                          className="mt-0.5 truncate text-[12px] font-black"
                          style={{ color: THEME.cardText }}
                          title={`${originInfo.label} · ${originInfo.description}`}
                        >
                          {originInfo.label} · {originInfo.description}
                        </div>

                        <div className="mt-0.5 truncate text-[10px] font-bold" style={{ color: THEME.mutedText }}>
                          {originInfo.detail}
                        </div>
                      </div>

                      <div
                        className="mt-2 rounded-2xl border px-3 py-2"
                        style={{
                          borderColor: ADMIN_BORDER,
                          background: THEME.inputBg,
                        }}
                      >
                        <div
                          className="text-[9px] font-black uppercase tracking-[0.16em]"
                          style={{ color: THEME.mutedText }}
                        >
                          {branchInfo.isMultiBranch
                            ? 'Despacho'
                            : 'Sede'}
                        </div>

                        <div
                          className="mt-0.5 truncate text-[11px] font-black"
                          style={{ color: branchInfo.hasBranch ? THEME.cardText : THEME.mutedText }}
                          title={
                            branchInfo.code
                              ? `${branchInfo.name} · ${branchInfo.code}`
                              : branchInfo.name
                          }
                        >
                          {branchInfo.name}
                        </div>

                        {branchInfo.code && (
                          <div
                            className="mt-0.5 font-mono text-[10px] font-black"
                            style={{ color: THEME.primary }}
                          >
                            {branchInfo.code}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="col-span-6 border-b px-5 py-5 sm:col-span-3 lg:col-span-2 lg:border-b-0 lg:border-r"
                      style={{ borderColor: ADMIN_BORDER }}
                    >
                      <div
                        className="text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ color: THEME.mutedText }}
                      >
                        Productos
                      </div>

                      <div className="mt-1 text-sm font-black" style={{ color: THEME.cardText }}>
                        {o.itemsCount ?? 0} ítems
                      </div>

                      <div className="mt-1 text-[11px]" style={{ color: THEME.mutedText }}>
                        {o.totalItems ?? 0} unidades
                      </div>
                    </div>

                    <div
                      className="col-span-6 min-w-0 px-4 py-5 sm:col-span-3 lg:col-span-2 lg:border-r"
                      style={{ borderColor: ADMIN_BORDER }}
                    >
                      <div
                        className="min-w-0 overflow-hidden rounded-3xl p-3 shadow-inner"
                        style={{
                          background: THEME.primarySoftBg,
                          color: THEME.cardText,
                        }}
                      >
                        <div
                          className="text-[10px] font-black uppercase tracking-[0.16em]"
                          style={{ color: THEME.mutedText }}
                        >
                          Total venta
                        </div>

                        <div
                          className="mt-1 max-w-full whitespace-nowrap font-black leading-tight tracking-[-0.04em]"
                          style={{
                            color: THEME.cardText,
                            fontSize: 'clamp(0.95rem, 1.22vw, 1.25rem)',
                          }}
                        >
                          {toCOP(o.total ?? 0)}
                        </div>

                        <div className="mt-1 max-w-full truncate text-[11px]" style={{ color: THEME.mutedText }}>
                          Subtotal {toCOP(o.subtotal ?? 0)}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-6 flex flex-col justify-center px-4 py-5 sm:col-span-3 lg:col-span-2">
                      <div className="flex w-full flex-col items-stretch justify-center gap-2">
                        <div className="flex w-full justify-center">
                          <span className={`inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black leading-none shadow-sm ${statusBadgeClasses(o.status)}`}>
                            {o.status || '—'}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="w-full rounded-2xl px-4 py-2 text-[11px] font-black text-white shadow-lg transition duration-200 hover:scale-105"
                          style={{
                            background: `linear-gradient(90deg, ${THEME.primary}, ${THEME.primaryHover})`,
                          }}
                          onClick={() => openOrderDetail(o)}
                        >
                          Abrir
                        </button>

                        <div
                          className="mt-1 flex min-w-0 flex-wrap justify-center gap-1 border-t pt-2"
                          style={{ borderColor: ADMIN_BORDER }}
                        >
                          {tags.length === 0 ? (
                            <span className="text-[11px] font-semibold" style={{ color: THEME.mutedText }}>
                              Sin tags
                            </span>
                          ) : (
                            tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold"
                                style={{
                                  borderColor: ADMIN_BORDER,
                                  background: THEME.primarySoftBg,
                                  color: THEME.primarySoftText,
                                }}
                              >
                                #{t}
                              </span>
                            ))
                          )}

                          {tags.length > 3 && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{
                                background: THEME.inputBg,
                                color: THEME.cardText,
                              }}
                            >
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
