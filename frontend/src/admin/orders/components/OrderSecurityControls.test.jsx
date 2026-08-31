import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrderDetailActionToolbar from './orderDetail/OrderDetailActionToolbar';
import OrderDetailFulfillmentPanel from './orderDetail/OrderDetailFulfillmentPanel';
import OrderDetailTimelineNotes from './orderDetail/OrderDetailTimelineNotes';

const ORDER = {
  _id: '64c000000000000000000001',
  orderNumber: 'ORD-SEG-001',
  status: 'paid',
  tags: ['vip'],
};

describe('controles de seguridad del detalle de órdenes', () => {
  afterEach(() => cleanup());

  it('no renderiza la barra de mutaciones para un perfil de solo lectura', () => {
    const { container } = render(
      <OrderDetailActionToolbar
        order={ORDER}
        statusLocal="paid"
        setStatusLocal={() => {}}
        tagsStr="vip"
        setTagsStr={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('mantiene un único contrato de cuatro correos administrativos', () => {
    const onSendEmail = vi.fn();
    render(
      <OrderDetailActionToolbar
        order={ORDER}
        statusLocal="paid"
        setStatusLocal={() => {}}
        tagsStr="vip"
        setTagsStr={() => {}}
        onSendEmail={onSendEmail}
        emailMenuOpen
        setEmailMenuOpen={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Confirmación de compra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Factura / soporte de compra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualización de estado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Información de pago' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Factura / soporte de compra' }));
    expect(onSendEmail).toHaveBeenCalledWith('invoice');
  });

  it('mantiene la barra como contenedor delgado y sus módulos bajo el límite', () => {
    const files = [
      ['OrderDetailActionToolbar.jsx', 180],
      ['OrderDetailActionControls.jsx', 300],
      ['OrderDetailActionForms.jsx', 300],
      ['OrderDetailQuickActions.jsx', 300],
      ['orderActionToolbarModel.js', 300],
    ];

    files.forEach(([fileName, limit]) => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          'src/admin/orders/components/orderDetail',
          fileName
        ),
        'utf8'
      );
      expect(source.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(limit);
    });
  });

  it('conserva orden, textos, opciones, foco y estados de todas las acciones', () => {
    const setStatusLocal = vi.fn();
    const setTagsStr = vi.fn();
    const setEmailMenuOpen = vi.fn();
    const onSendEmail = vi.fn();
    const emailBtnRef = React.createRef();

    const { container } = render(
      <OrderDetailActionToolbar
        order={{ ...ORDER, tags: ['vip', 'urgente'] }}
        statusLocal="paid"
        setStatusLocal={setStatusLocal}
        onSaveStatus={vi.fn()}
        tagsStr="vip, urgente"
        setTagsStr={setTagsStr}
        onSaveTags={vi.fn()}
        onTogglePrinted={vi.fn()}
        onToggleArchived={vi.fn()}
        emailMenuOpen
        setEmailMenuOpen={setEmailMenuOpen}
        emailBtnRef={emailBtnRef}
        onSendEmail={onSendEmail}
        onPrepareWhatsApp={vi.fn()}
      />
    );

    const section = container.querySelector('section');
    const actionGroups = Array.from(section?.firstElementChild?.children || []);
    const buttons = screen.getAllByRole('button');

    expect(section).toBeInTheDocument();
    expect(actionGroups).toHaveLength(3);
    expect(actionGroups[0]).toHaveTextContent('Estado de la orden');
    expect(actionGroups[1]).toHaveTextContent('Etiquetas internas');
    expect(actionGroups[2]).toHaveTextContent('Acciones rápidas');
    expect(buttons.map((button) => button.textContent?.trim())).toEqual([
      'Guardar',
      'Guardar tags',
      'Marcar como impresa',
      'Archivar orden',
      'Enviar email',
      'Confirmación de compra',
      'Factura / soporte de compra',
      'Actualización de estado',
      'Información de pago',
      'Informar por WhatsApp',
    ]);
    buttons.forEach((button) => expect(button).toHaveAttribute('type', 'button'));

    const statusSelect = screen.getByRole('combobox');
    const refundedOption = screen.getByRole('option', {
      name: 'Reembolsado (solo devolución)',
    });
    expect(refundedOption).toBeDisabled();
    fireEvent.change(statusSelect, { target: { value: 'processing' } });
    expect(setStatusLocal).toHaveBeenCalledWith('processing');

    fireEvent.change(screen.getByPlaceholderText('vip, urgente, mayorista...'), {
      target: { value: 'nuevo' },
    });
    expect(setTagsStr).toHaveBeenCalledWith('nuevo');

    const emailButton = screen.getByRole('button', { name: 'Enviar email' });
    emailButton.focus();
    expect(document.activeElement).toBe(emailButton);
    expect(emailBtnRef.current).toContainElement(emailButton);
    expect(
      screen.getByRole('button', { name: 'Informar por WhatsApp' })
    ).toHaveAttribute(
      'title',
      'Preparar un informe con el estado actual de la orden.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Información de pago' }));
    expect(onSendEmail).toHaveBeenCalledWith('payment');
  });

  it('conserva argumentos y refresco posterior de cada mutación', async () => {
    const onSaveStatus = vi.fn().mockResolvedValue({});
    const onSaveTags = vi.fn().mockResolvedValue({});
    const onTogglePrinted = vi.fn().mockResolvedValue({});
    const onToggleArchived = vi.fn().mockResolvedValue({});
    const onRefreshTimeline = vi.fn().mockResolvedValue([]);

    render(
      <OrderDetailActionToolbar
        order={ORDER}
        statusLocal="processing"
        setStatusLocal={vi.fn()}
        onSaveStatus={onSaveStatus}
        tagsStr=" VIP, Urgente   Mayorista, ,"
        setTagsStr={vi.fn()}
        onSaveTags={onSaveTags}
        printed={false}
        archived
        onTogglePrinted={onTogglePrinted}
        onToggleArchived={onToggleArchived}
        onRefreshTimeline={onRefreshTimeline}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(onSaveStatus).toHaveBeenCalledWith(ORDER._id, 'processing');
      expect(onRefreshTimeline).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar tags' }));
    await waitFor(() => {
      expect(onSaveTags).toHaveBeenCalledWith(ORDER._id, [
        'vip',
        'urgente mayorista',
      ]);
      expect(onRefreshTimeline).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como impresa' }));
    await waitFor(() => {
      expect(onTogglePrinted).toHaveBeenCalledWith(ORDER._id, true);
      expect(onRefreshTimeline).toHaveBeenCalledTimes(3);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Desarchivar orden' }));
    await waitFor(() => {
      expect(onToggleArchived).toHaveBeenCalledWith(ORDER._id, false);
      expect(onRefreshTimeline).toHaveBeenCalledTimes(4);
    });
  });

  it('muestra historial y notas sin permitir crear notas nuevas', () => {
    render(
      <OrderDetailTimelineNotes
        order={ORDER}
        timeline={[]}
        notes={[{ _id: 'note-1', content: 'Solo lectura' }]}
        tags={ORDER.tags}
      />
    );

    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/agregar una nota interna/i)).not.toBeInTheDocument();
  });

  it('permite consultar prestaciones sin editar cuando falta orders:fulfillment', () => {
    render(
      <OrderDetailFulfillmentPanel
        order={{
          ...ORDER,
          fulfillment: {
            status: 'processing',
            services: [
              {
                _id: 'service-1',
                title: 'Instalación',
                status: 'awaiting_scheduling',
                quantity: 1,
              },
            ],
          },
        }}
        canUpdate={false}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar prestación' })).not.toBeInTheDocument();
  });
});
