import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
