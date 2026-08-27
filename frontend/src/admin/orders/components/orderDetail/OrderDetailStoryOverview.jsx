import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate } from './orderDetailUtils';
import { OrderDetailIcons, IconBadge } from './OrderDetailIcons';
import {
  OrderDetailPanel,
  PrimaryButton,
  SectionTitle,
} from './OrderDetailPrimitives';
import { buildOrderOverview } from './orderStoryViewModel';

export { buildOrderOverview, buildOrderStory } from './orderStoryViewModel';

function StorySummaryCard({ eyebrow, title, description, icon, tone = 'primary' }) {
  const tones = {
    primary: { color: ORDER_DETAIL_THEME.primary, background: ORDER_DETAIL_THEME.primarySoftBg },
    success: { color: '#15803d', background: 'rgba(34, 197, 94, 0.10)' },
    warning: { color: '#b45309', background: 'rgba(245, 158, 11, 0.11)' },
    danger: { color: '#b91c1c', background: 'rgba(239, 68, 68, 0.10)' },
  };
  const currentTone = tones[tone] || tones.primary;

  return (
    <article
      data-story-card={eyebrow}
      style={{
        minWidth: 0,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderTop: `3px solid ${currentTone.color}`,
        borderRadius: 18,
        background: `linear-gradient(145deg, ${currentTone.background}, ${ORDER_DETAIL_THEME.cardBg})`,
        padding: 15,
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr)',
        gap: 11,
      }}
    >
      <IconBadge icon={icon} size={38} iconSize={16} variant={tone === 'primary' ? 'primary' : tone} />
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: currentTone.color,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}
        >
          {eyebrow}
        </span>
        <strong
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 13,
            fontWeight: 950,
            lineHeight: 1.25,
          }}
        >
          {title}
        </strong>
        <p
          style={{
            margin: '6px 0 0',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 11,
            fontWeight: 650,
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

function SituationCard({ label, value, icon, tone = 'primary' }) {
  return (
    <article
      style={{
        minWidth: 0,
        minHeight: 78,
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 17,
        background: ORDER_DETAIL_THEME.inputBg,
        padding: '13px 15px',
      }}
    >
      <IconBadge
        icon={icon}
        size={38}
        iconSize={16}
        variant={tone === 'primary' ? 'primary' : tone}
      />
      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 13,
            fontWeight: 950,
            lineHeight: 1.2,
          }}
        >
          {label}
        </strong>
        <span
          style={{
            display: 'block',
            marginTop: 5,
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          {value}
        </span>
      </div>
    </article>
  );
}

function MovementRow({ movement, isLast }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '38px minmax(0, 1fr) auto',
        gap: 11,
        alignItems: 'start',
        padding: '13px 0',
        borderBottom: isLast ? 'none' : `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
      }}
    >
      <IconBadge
        icon={movement.icon}
        size={36}
        iconSize={15}
        variant={movement.tone === 'primary' ? 'primary' : movement.tone}
      />
      <div style={{ minWidth: 0 }}>
        <strong
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 13,
            fontWeight: 950,
            lineHeight: 1.25,
          }}
        >
          {movement.title}
        </strong>
        <span
          style={{
            display: 'block',
            marginTop: 4,
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 11,
            fontWeight: 650,
            lineHeight: 1.35,
          }}
        >
          {movement.description}
        </span>
      </div>
      <span
        style={{
          maxWidth: 104,
          color: ORDER_DETAIL_THEME.mutedText,
          fontSize: 10,
          fontWeight: 750,
          lineHeight: 1.35,
          textAlign: 'right',
        }}
      >
        {movement.date ? fmtDate(movement.date) : 'Estado actual'}
      </span>
    </div>
  );
}

export default function OrderDetailStoryOverview({ order, refunds = [], onNavigate }) {
  const overview = buildOrderOverview(order, refunds);
  const { story } = overview;

  return (
    <div className="order-story-overview">
      <div className="order-story-summary-grid">
        <StorySummaryCard
          eyebrow="Qué pasó"
          title={story.happened.title}
          description={story.happened.description}
          icon={OrderDetailIcons.ClipboardList}
          tone="success"
        />
        <StorySummaryCard
          eyebrow="Estado actual"
          title={story.current.title}
          description={story.current.description}
          icon={story.current.tone === 'danger' ? OrderDetailIcons.AlertTriangle : OrderDetailIcons.Zap}
          tone={story.current.tone}
        />
        <StorySummaryCard
          eyebrow="Qué sigue"
          title={story.next.title}
          description={story.next.description}
          icon={OrderDetailIcons.CheckCircle2}
          tone={story.next.tone}
        />
      </div>

      <OrderDetailPanel style={{ padding: 18 }}>
        <SectionTitle title="Situación de la orden" />
        <div className="order-story-situation-grid">
          {overview.situation.map((item) => (
            <SituationCard key={item.id} {...item} />
          ))}
        </div>
      </OrderDetailPanel>

      <div className="order-story-bottom-grid">
        <OrderDetailPanel style={{ padding: 18 }}>
          <SectionTitle
            icon={OrderDetailIcons.History}
            title="Últimos movimientos"
            subtitle="Los eventos más recientes que explican el estado actual."
          />
          <div>
            {overview.movements.map((movement, index) => (
              <MovementRow
                key={`${movement.id}-${index}`}
                movement={movement}
                isLast={index === overview.movements.length - 1}
              />
            ))}
          </div>
        </OrderDetailPanel>

        <OrderDetailPanel
          style={{
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SectionTitle
            icon={OrderDetailIcons.Zap}
            title="Acción recomendada"
            subtitle="El siguiente paso coherente para continuar la orden."
          />
          <strong
            style={{
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 16,
              fontWeight: 950,
              lineHeight: 1.25,
            }}
          >
            {overview.action.title}
          </strong>
          <p
            style={{
              margin: '8px 0 20px',
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 12,
              fontWeight: 650,
              lineHeight: 1.55,
            }}
          >
            {overview.action.description}
          </p>
          <div className="order-story-action-button" style={{ marginTop: 'auto' }}>
            <PrimaryButton
              onClick={
                typeof onNavigate === 'function'
                  ? () => onNavigate(overview.action.targetTab)
                  : undefined
              }
              icon={<OrderDetailIcons.ExternalLink size={15} strokeWidth={2.4} />}
            >
              {overview.action.label}
            </PrimaryButton>
          </div>
        </OrderDetailPanel>
      </div>

      <style>
        {`
          .order-story-overview {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .order-story-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }

          .order-story-situation-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .order-story-bottom-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr);
            gap: 16px;
            align-items: stretch;
          }

          .order-story-action-button > button {
            width: 100%;
            min-height: 48px !important;
            justify-content: space-between !important;
          }

          @media (max-width: 900px) {
            .order-story-summary-grid,
            .order-story-situation-grid,
            .order-story-bottom-grid {
              grid-template-columns: 1fr;
            }
          }

        `}
      </style>
    </div>
  );
}
