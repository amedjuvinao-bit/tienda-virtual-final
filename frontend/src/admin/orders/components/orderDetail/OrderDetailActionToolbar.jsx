import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  OrderStatusActionCard,
  OrderTagsActionCard,
} from './OrderDetailActionForms';
import OrderDetailQuickActions from './OrderDetailQuickActions';
import { buildOrderActionToolbarModel } from './orderActionToolbarModel';

export default function OrderDetailActionToolbar({
  order,
  compact = false,
  statusLocal,
  setStatusLocal,
  onSaveStatus,
  disabled = false,
  tagsStr,
  setTagsStr,
  onSaveTags,
  savingTags = false,
  printed = false,
  archived = false,
  onTogglePrinted,
  onToggleArchived,
  emailMenuOpen = false,
  setEmailMenuOpen,
  emailBtnRef,
  onSendEmail,
  onPrepareWhatsApp,
  whatsAppAvailable = true,
  whatsAppUnavailableReason = '',
  loadingAux = false,
  onRefreshTimeline,
}) {
  const model = buildOrderActionToolbarModel({
    archived,
    onPrepareWhatsApp,
    onRefreshTimeline,
    onSaveStatus,
    onSaveTags,
    onSendEmail,
    onToggleArchived,
    onTogglePrinted,
    order,
    printed,
    statusLocal,
    tagsStr,
  });

  if (!model.hasAnyActions) return null;

  return (
    <section
      style={{
        border: compact ? 'none' : `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: compact ? 'transparent' : ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: compact ? 0 : 24,
        padding: compact ? 0 : 16,
        boxShadow: compact ? 'none' : '0 14px 42px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fit, minmax(230px, 1fr))'
            : 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {model.canUpdateStatus ? (
          <OrderStatusActionCard
            disabled={disabled}
            onSave={model.saveStatus}
            setStatusLocal={setStatusLocal}
            statusBlocked={model.statusBlocked}
            statusLocal={statusLocal}
            statusOptions={model.statusOptions}
          />
        ) : null}

        {model.canUpdateTags ? (
          <OrderTagsActionCard
            currentTags={model.currentTags}
            onSave={model.saveTags}
            savingTags={savingTags}
            setTagsStr={setTagsStr}
            tagsStr={tagsStr}
          />
        ) : null}

        {model.hasQuickActions ? (
          <OrderDetailQuickActions
            archived={archived}
            canPrepareWhatsApp={model.canPrepareWhatsApp}
            canSendEmail={model.canSendEmail}
            canToggleArchived={model.canToggleArchived}
            canTogglePrinted={model.canTogglePrinted}
            disabled={disabled}
            emailBtnRef={emailBtnRef}
            emailMenuOpen={emailMenuOpen}
            loadingAux={loadingAux}
            onPrepareWhatsApp={onPrepareWhatsApp}
            onSendEmail={onSendEmail}
            printed={printed}
            setEmailMenuOpen={setEmailMenuOpen}
            toggleArchived={model.toggleArchived}
            togglePrinted={model.togglePrinted}
            whatsAppAvailable={whatsAppAvailable}
            whatsAppUnavailableReason={whatsAppUnavailableReason}
          />
        ) : null}
      </div>

      <style>
        {`
          @media (max-width: 640px) {
            div[style*="grid-template-columns: minmax(0, 1fr) auto"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </section>
  );
}
