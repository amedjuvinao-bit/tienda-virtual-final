// frontend/src/admin/orders/components/orderDetail/OrderDetailProgressStepper.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate, normalizeText } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';

const STEPS = [
  {
    key: 'received',
    label: 'Recibida',
    icon: OrderDetailIcons.ClipboardList,
  },
  {
    key: 'confirmed',
    label: 'Confirmada',
    icon: OrderDetailIcons.ShieldCheck,
  },
  {
    key: 'preparing',
    label: 'Preparando',
    icon: OrderDetailIcons.PackageCheck,
  },
  {
    key: 'shipped',
    label: 'Enviada',
    icon: OrderDetailIcons.Truck,
  },
  {
    key: 'delivered',
    label: 'Entregada',
    icon: OrderDetailIcons.CheckCircle2,
  },
];

function getActiveStep(order) {
  const status = normalizeText(order?.status);

  if (status.includes('delivered') || status.includes('entreg')) return 4;
  if (status.includes('shipped') || status.includes('env')) return 3;
  if (status.includes('processing') || status.includes('prepar')) return 2;
  if (status.includes('paid') || status.includes('pag') || status.includes('confirm')) return 1;

  return 0;
}

export default function OrderDetailProgressStepper({ order }) {
  const activeStep = getActiveStep(order);

  return (
    <section
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 24,
        padding: '18px 20px',
        boxShadow: '0 14px 42px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 15,
              fontWeight: 950,
              letterSpacing: '-0.02em',
            }}
          >
            Progreso de la orden
          </h3>

          <p
            style={{
              margin: '5px 0 0',
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            Creada el {fmtDate(order?.createdAt)}
          </p>
        </div>

        <span
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            background: ORDER_DETAIL_THEME.primarySoftBg,
            color: ORDER_DETAIL_THEME.primary,
            borderRadius: 999,
            padding: '7px 11px',
            fontSize: 10,
            fontWeight: 950,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          Paso {activeStep + 1} de {STEPS.length}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`,
          gap: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: '8%',
            right: '8%',
            height: 3,
            borderRadius: 999,
            background: ORDER_DETAIL_THEME.cardBorder,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${(activeStep / (STEPS.length - 1)) * 100}%`,
              height: '100%',
              borderRadius: 999,
              background: `linear-gradient(90deg, ${ORDER_DETAIL_THEME.primary}, ${ORDER_DETAIL_THEME.primaryHover})`,
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const completed = index <= activeStep;
          const current = index === activeStep;

          return (
            <div
              key={step.key}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                minWidth: 0,
                gap: 8,
              }}
            >
              <div
                style={{
                  width: current ? 48 : 44,
                  height: current ? 48 : 44,
                  borderRadius: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${
                    completed ? ORDER_DETAIL_THEME.primary : ORDER_DETAIL_THEME.cardBorder
                  }`,
                  background: completed
                    ? `linear-gradient(135deg, ${ORDER_DETAIL_THEME.primary}, ${ORDER_DETAIL_THEME.primaryHover})`
                    : ORDER_DETAIL_THEME.inputBg,
                  color: completed
                    ? ORDER_DETAIL_THEME.primaryText
                    : ORDER_DETAIL_THEME.mutedText,
                  boxShadow: current
                    ? '0 14px 30px rgba(236, 72, 153, 0.25)'
                    : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                <Icon size={18} strokeWidth={2.4} />
              </div>

              <strong
                style={{
                  display: 'block',
                  color: completed ? ORDER_DETAIL_THEME.cardText : ORDER_DETAIL_THEME.mutedText,
                  fontSize: 12,
                  fontWeight: current ? 950 : 800,
                  lineHeight: 1.15,
                }}
              >
                {step.label}
              </strong>

              <span
                style={{
                  display: 'block',
                  color: ORDER_DETAIL_THEME.mutedText,
                  fontSize: 10,
                  fontWeight: 650,
                  lineHeight: 1.2,
                }}
              >
                {index === 0 ? fmtDate(order?.createdAt) : 'Pendiente'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}