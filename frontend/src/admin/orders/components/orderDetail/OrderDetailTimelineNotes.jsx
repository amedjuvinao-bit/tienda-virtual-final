// frontend/src/admin/orders/components/orderDetail/OrderDetailTimelineNotes.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  descriptionForEvent,
  fmtDate,
  normalizeTags,
  titleForEvent,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  EmptyState,
  GhostButton,
  OrderDetailPanel,
  PrimaryButton,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

export default function OrderDetailTimelineNotes({
  order,
  timeline = [],
  notes = [],
  tags = [],
  noteText = '',
  setNoteText,
  onSaveNote,
  savingNote = false,
}) {
  const normalizedTags = normalizeTags(tags || order?.tags);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 14,
      }}
    >
      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.History}
          title="Historial"
          subtitle="Movimientos recientes de la orden"
          action={
            timeline.length > 0 ? (
              <SoftBadge variant="neutral">
                {timeline.length} evento(s)
              </SoftBadge>
            ) : null
          }
        />

        {timeline.length === 0 ? (
          <EmptyState>No hay eventos registrados para esta orden.</EmptyState>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
              maxHeight: 320,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {timeline.map((event, index) => (
              <TimelineItem
                key={event?._id || event?.id || `${event?.type || 'event'}-${index}`}
                event={event}
                isLast={index === timeline.length - 1}
              />
            ))}
          </div>
        )}
      </OrderDetailPanel>

      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.StickyNote}
          title="Notas internas"
          subtitle="Comentarios privados para gestión administrativa"
          action={
            notes.length > 0 ? (
              <SoftBadge variant="neutral">
                {notes.length} nota(s)
              </SoftBadge>
            ) : null
          }
        />

        <div
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          {typeof onSaveNote === 'function' ? (
          <div
            style={{
              border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
              background: ORDER_DETAIL_THEME.inputBg,
              borderRadius: 18,
              padding: 12,
            }}
          >
            <textarea
              value={noteText}
              onChange={(event) => {
                if (setNoteText) setNoteText(event.target.value);
              }}
              placeholder="Agregar una nota interna sobre esta orden..."
              rows={4}
              style={{
                width: '100%',
                resize: 'vertical',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: ORDER_DETAIL_THEME.cardText,
                fontSize: 13,
                fontWeight: 650,
                lineHeight: 1.45,
                fontFamily: 'inherit',
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 10,
              }}
            >
              <PrimaryButton
                onClick={onSaveNote}
                disabled={savingNote || !String(noteText || '').trim()}
                icon={<OrderDetailIcons.StickyNote size={15} strokeWidth={2.4} />}
              >
                {savingNote ? 'Guardando...' : 'Guardar nota'}
              </PrimaryButton>
            </div>
          </div>
          ) : null}

          {normalizedTags.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {normalizedTags.map((tag) => (
                <SoftBadge key={tag} variant="primary">
                  {tag}
                </SoftBadge>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <SoftBadge variant="neutral">Sin etiquetas</SoftBadge>
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState>No hay notas internas guardadas.</EmptyState>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 10,
                maxHeight: 210,
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {notes.map((note, index) => (
                <NoteItem
                  key={note?._id || note?.id || `note-${index}`}
                  note={note}
                />
              ))}
            </div>
          )}
        </div>
      </OrderDetailPanel>

      <style>
        {`
          @media (max-width: 900px) {
            div[style*="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}

function TimelineItem({ event, isLast }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr)',
        gap: 10,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {!isLast ? (
          <span
            style={{
              position: 'absolute',
              top: 32,
              bottom: -12,
              width: 2,
              borderRadius: 999,
              background: ORDER_DETAIL_THEME.cardBorder,
            }}
          />
        ) : null}

        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: ORDER_DETAIL_THEME.primarySoftBg,
            color: ORDER_DETAIL_THEME.primary,
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            zIndex: 1,
          }}
        >
          <OrderDetailIcons.Clock3 size={14} strokeWidth={2.4} />
        </span>
      </div>

      <div
        style={{
          minWidth: 0,
          border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
          background: ORDER_DETAIL_THEME.inputBg,
          borderRadius: 16,
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <strong
            style={{
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 13,
              fontWeight: 900,
              lineHeight: 1.25,
            }}
          >
            {titleForEvent(event)}
          </strong>

          <span
            style={{
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 10,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {fmtDate(event?.createdAt || event?.date)}
          </span>
        </div>

        <p
          style={{
            margin: '6px 0 0',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 12,
            fontWeight: 650,
            lineHeight: 1.4,
          }}
        >
          {descriptionForEvent(event)}
        </p>
      </div>
    </div>
  );
}

function NoteItem({ note }) {
  const author =
    note?.createdByName ||
    note?.authorName ||
    note?.createdBy?.name ||
    note?.createdBy?.username ||
    'Admin';

  const content =
    note?.content ||
    note?.note ||
    note?.message ||
    '';

  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 16,
        padding: '11px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 7,
        }}
      >
        <strong
          style={{
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {author}
        </strong>

        <span
          style={{
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 10,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {fmtDate(note?.createdAt || note?.date)}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          color: ORDER_DETAIL_THEME.mutedText,
          fontSize: 12,
          fontWeight: 650,
          lineHeight: 1.45,
        }}
      >
        {content || 'Sin contenido'}
      </p>
    </div>
  );
}
