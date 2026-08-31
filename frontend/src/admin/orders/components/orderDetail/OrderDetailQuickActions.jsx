import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  ActionButton,
  ActionLabel,
  EmailButton,
} from './OrderDetailActionControls';

export default function OrderDetailQuickActions({
  archived,
  canPrepareWhatsApp,
  canSendEmail,
  canToggleArchived,
  canTogglePrinted,
  disabled,
  emailBtnRef,
  emailMenuOpen,
  loadingAux,
  onPrepareWhatsApp,
  onSendEmail,
  printed,
  setEmailMenuOpen,
  toggleArchived,
  togglePrinted,
  whatsAppAvailable,
  whatsAppUnavailableReason,
}) {
  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 18,
        padding: 14,
        minWidth: 0,
      }}
    >
      <ActionLabel>Acciones rápidas</ActionLabel>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 9,
          marginTop: 8,
        }}
      >
        {canTogglePrinted ? (
          <ActionButton
            onClick={togglePrinted}
            disabled={disabled}
            icon={<OrderDetailIcons.FileText size={15} strokeWidth={2.4} />}
          >
            {printed ? 'Quitar marca de impresa' : 'Marcar como impresa'}
          </ActionButton>
        ) : null}

        {canToggleArchived ? (
          <ActionButton
            onClick={toggleArchived}
            disabled={disabled}
            icon={<OrderDetailIcons.PackageCheck size={15} strokeWidth={2.4} />}
          >
            {archived ? 'Desarchivar orden' : 'Archivar orden'}
          </ActionButton>
        ) : null}

        {canSendEmail ? (
          <div
            ref={emailBtnRef}
            style={{
              position: 'relative',
              display: 'block',
              width: '100%',
            }}
          >
            <ActionButton
              onClick={() => setEmailMenuOpen((value) => !value)}
              disabled={loadingAux}
              icon={<OrderDetailIcons.Mail size={15} strokeWidth={2.4} />}
            >
              Enviar email
            </ActionButton>

            {emailMenuOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  zIndex: 40,
                  width: 230,
                  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                  background: ORDER_DETAIL_THEME.cardBg,
                  color: ORDER_DETAIL_THEME.cardText,
                  borderRadius: 16,
                  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
                  padding: 8,
                }}
              >
                <EmailButton onClick={() => onSendEmail('confirmation')}>
                  Confirmación de compra
                </EmailButton>

                <EmailButton onClick={() => onSendEmail('invoice')}>
                  Factura / soporte de compra
                </EmailButton>

                <EmailButton onClick={() => onSendEmail('status')}>
                  Actualización de estado
                </EmailButton>

                <EmailButton onClick={() => onSendEmail('payment')}>
                  Información de pago
                </EmailButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {canPrepareWhatsApp ? (
          <div>
            <ActionButton
              onClick={onPrepareWhatsApp}
              disabled={loadingAux || !whatsAppAvailable}
              title={
                whatsAppAvailable
                  ? 'Preparar un informe con el estado actual de la orden.'
                  : whatsAppUnavailableReason
              }
              icon={(
                <OrderDetailIcons.MessageCircle
                  size={15}
                  strokeWidth={2.4}
                />
              )}
            >
              Informar por WhatsApp
            </ActionButton>
            {!whatsAppAvailable && whatsAppUnavailableReason ? (
              <div
                style={{
                  marginTop: 6,
                  color: ORDER_DETAIL_THEME.mutedText,
                  fontSize: 10,
                  fontWeight: 720,
                  lineHeight: 1.35,
                }}
              >
                {whatsAppUnavailableReason}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
