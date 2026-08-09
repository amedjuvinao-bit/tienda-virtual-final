import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';

const SERVICE_STATUSES = [
  ['awaiting_scheduling', 'Por agendar'],
  ['scheduled', 'Agendado'],
  ['in_progress', 'En curso'],
  ['completed', 'Completado'],
  ['cancelled', 'Cancelado'],
];

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function statusLabel(value) {
  return (
    SERVICE_STATUSES.find(([status]) => status === value)?.[1] ||
    value ||
    'Pendiente'
  );
}

export default function OrderDetailFulfillmentPanel({ order }) {
  const fulfillment = order?.fulfillment || {};
  const digitalDeliveries = Array.isArray(
    fulfillment.digitalDeliveries
  )
    ? fulfillment.digitalDeliveries
    : [];
  const [services, setServices] = useState([]);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setServices(
      Array.isArray(fulfillment.services)
        ? fulfillment.services.map((service) => ({
            ...service,
            scheduledAtInput: formatDateTimeLocal(
              service.scheduledAt
            ),
            notesInput: service.notes || '',
          }))
        : []
    );
    setMessage('');
  }, [order?._id, fulfillment.processedAt]);

  if (!digitalDeliveries.length && !services.length) {
    return null;
  }

  const updateLocal = (serviceId, patch) => {
    setServices((previous) =>
      previous.map((service) =>
        String(service._id) === String(serviceId)
          ? { ...service, ...patch }
          : service
      )
    );
  };

  const saveService = async (service) => {
    try {
      setSavingId(String(service._id));
      setMessage('');
      const { data } = await api.patch(
        `/api/orders/${order._id}/fulfillment/services/${service._id}`,
        {
          status: service.status,
          scheduledAt: service.scheduledAtInput || null,
          notes: service.notesInput || '',
        }
      );
      updateLocal(service._id, {
        ...(data?.service || service),
        scheduledAtInput: formatDateTimeLocal(
          data?.service?.scheduledAt ||
            service.scheduledAtInput
        ),
        notesInput:
          data?.service?.notes ?? service.notesInput,
      });
      setMessage('Prestación actualizada correctamente.');
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          'No fue posible actualizar la prestación.'
      );
    } finally {
      setSavingId('');
    }
  };

  return (
    <section
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 22,
        background: ORDER_DETAIL_THEME.cardBg,
        padding: 16,
        boxShadow: '0 12px 36px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 15,
              fontWeight: 950,
            }}
          >
            Cumplimiento de productos
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            Entregas digitales y prestaciones generadas después del pago.
          </p>
        </div>
        <span
          style={{
            borderRadius: 999,
            padding: '6px 10px',
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-primary)',
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {fulfillment.status || 'pending'}
        </span>
      </div>

      {digitalDeliveries.length > 0 && (
        <div style={{ display: 'grid', gap: 8, marginBottom: services.length ? 16 : 0 }}>
          <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 12, fontWeight: 900 }}>
            Entregas digitales
          </div>
          {digitalDeliveries.map((delivery) => (
            <div
              key={delivery._id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 12,
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 12, fontWeight: 850 }}>
                  {delivery.title || delivery.fileName || 'Archivo digital'}
                </div>
                <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
                  {delivery.fileName || 'Entrega manual'} · {Number(delivery.downloadCount || 0)}/{Number(delivery.downloadLimit || 1)} descargas
                </div>
              </div>
              <span style={{ color: 'var(--admin-primary)', fontSize: 11, fontWeight: 900 }}>
                {delivery.status === 'ready'
                  ? 'Disponible'
                  : delivery.status === 'manual'
                    ? 'Manual'
                    : delivery.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 12, fontWeight: 900 }}>
            Prestaciones de servicio
          </div>
          {services.map((service) => (
            <div
              key={service._id}
              style={{
                display: 'grid',
                gap: 10,
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div>
                <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 12, fontWeight: 850 }}>
                  {service.quantity > 1 ? `${service.quantity} × ` : ''}
                  {service.title || 'Servicio'}
                </div>
                <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
                  {Number(service.durationMinutes || 60)} minutos · {statusLabel(service.status)}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(150px, 0.8fr) minmax(190px, 1fr)',
                  gap: 8,
                }}
              >
                <select
                  value={service.status || 'awaiting_scheduling'}
                  onChange={(event) =>
                    updateLocal(service._id, {
                      status: event.target.value,
                    })
                  }
                  style={{
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 10,
                    minHeight: 38,
                    padding: '0 10px',
                    background: ORDER_DETAIL_THEME.cardBg,
                    color: ORDER_DETAIL_THEME.cardText,
                    fontSize: 12,
                    fontWeight: 750,
                  }}
                >
                  {SERVICE_STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={service.scheduledAtInput || ''}
                  onChange={(event) =>
                    updateLocal(service._id, {
                      scheduledAtInput: event.target.value,
                    })
                  }
                  style={{
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 10,
                    minHeight: 38,
                    padding: '0 10px',
                    background: ORDER_DETAIL_THEME.cardBg,
                    color: ORDER_DETAIL_THEME.cardText,
                    fontSize: 12,
                  }}
                />
              </div>

              <textarea
                rows={2}
                value={service.notesInput || ''}
                onChange={(event) =>
                  updateLocal(service._id, {
                    notesInput: event.target.value,
                  })
                }
                placeholder="Notas operativas de la prestación"
                style={{
                  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                  borderRadius: 10,
                  padding: 10,
                  resize: 'vertical',
                  background: ORDER_DETAIL_THEME.cardBg,
                  color: ORDER_DETAIL_THEME.cardText,
                  fontSize: 12,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => saveService(service)}
                  disabled={savingId === String(service._id)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '9px 14px',
                    background: 'var(--admin-primary)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity:
                      savingId === String(service._id)
                        ? 0.55
                        : 1,
                  }}
                >
                  {savingId === String(service._id)
                    ? 'Guardando…'
                    : 'Guardar prestación'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p
          style={{
            margin: '12px 0 0',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 11,
            fontWeight: 750,
          }}
        >
          {message}
        </p>
      )}
    </section>
  );
}
