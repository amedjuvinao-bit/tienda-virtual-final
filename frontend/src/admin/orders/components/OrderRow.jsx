export default function OrderRow({
  o,
  ADMIN_BORDER,

  isSelected,
  toggleOne,

  fmtDate,
  toCOP,
  statusBadgeClasses,

  openOrderDetail,
}) {
  const cust = o.customer || {};
  const name = [cust.name, cust.lastname].filter(Boolean).join(' ') || 'Cliente';
  const tags = Array.isArray(o.tags) ? o.tags : [];

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <tr
      className="group border-b bg-white/80 transition hover:bg-pink-50/70"
      style={{ borderColor: ADMIN_BORDER }}
    >
      <td className="px-2 py-3">
        <input
          type="checkbox"
          className="accent-pink-600"
          checked={isSelected(o._id)}
          onChange={() => toggleOne(o._id)}
        />
      </td>

      <td className="whitespace-nowrap px-2 py-3 text-gray-600">
        {fmtDate(o.createdAt)}
      </td>

      <td className="whitespace-nowrap px-2 py-3">
        <span className="font-mono text-[11px] font-bold text-pink-700">
          #{o.orderNumber || '—'}
        </span>
      </td>

      <td className="px-2 py-3">
        <div className="flex max-w-[180px] items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 to-white text-[11px] font-black text-pink-700 ring-1 ring-pink-200">
            {initials || 'C'}
          </div>

          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-900">{name}</div>
            <div className="text-[10px] text-gray-400">Cliente registrado</div>
          </div>
        </div>
      </td>

      <td className="px-2 py-3">
        <div className="flex max-w-[170px] flex-col">
          <span className="truncate text-gray-700">
            {cust.email || cust.emailOrPhone || '—'}
          </span>
          <span className="truncate text-[10px] text-gray-400">
            {cust.phone || ''}
          </span>
        </div>
      </td>

      <td className="px-2 py-3 text-center">
        <span className="rounded-lg bg-pink-50 px-2 py-1 text-xs font-bold text-pink-700">
          {o.itemsCount ?? 0}
        </span>
      </td>

      <td className="whitespace-nowrap px-2 py-3 text-right text-gray-600">
        {toCOP(o.subtotal ?? 0)}
      </td>

      <td className="whitespace-nowrap px-2 py-3 text-right">
        <span className="text-sm font-black text-pink-700">
          {toCOP(o.total ?? 0)}
        </span>
      </td>

      <td className="px-2 py-3 text-center">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold shadow-sm ${statusBadgeClasses(
            o.status
          )}`}
        >
          {o.status || '—'}
        </span>
      </td>

      <td className="px-2 py-3 text-center">
        {tags.length === 0 ? (
          <span className="text-[11px] text-gray-300">—</span>
        ) : (
          <div className="flex max-w-[70px] flex-wrap justify-center gap-1">
            {tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full border bg-white px-1.5 py-0.5 text-[9px] text-pink-700"
                style={{ borderColor: ADMIN_BORDER }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="px-2 py-3 text-center">
        <button
          type="button"
          className="whitespace-nowrap rounded-lg border bg-white px-2.5 py-1 text-[10px] font-bold text-gray-700 transition hover:bg-pink-600 hover:text-white"
          style={{ borderColor: ADMIN_BORDER }}
          onClick={() => openOrderDetail(o)}
        >
          Ver
        </button>
      </td>
    </tr>
  );
}