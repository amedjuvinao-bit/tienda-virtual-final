import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OrderWhatsAppPreview from './OrderWhatsAppPreview';

const preview = {
  recipient: {
    name: 'María Pérez',
    maskedPhone: '+57 ••••••4567',
  },
  report: {
    orderNumber: 'OTR-WHATSAPP-001',
    stage: 'Pedido despachado',
    happened: 'El pedido fue entregado a la operación de transporte.',
    current: 'La orden salió de la sede.',
    next: 'La transportadora continuará el recorrido.',
    details: [
      { label: 'Transportadora', value: 'Envia' },
      { label: 'Guía', value: 'GUIA-123456' },
    ],
  },
  message: 'Hola, María.\n\nEstado actual: Pedido despachado.',
  whatsappUrl:
    'https://wa.me/573001234567?text=Hola%2C%20Mar%C3%ADa.',
};

afterEach(() => cleanup());

describe('OrderWhatsAppPreview', () => {
  it('muestra el relato, el destino enmascarado y abre el enlace preparado', () => {
    const onOpenWhatsApp = vi.fn();

    render(
      <OrderWhatsAppPreview
        open
        preview={preview}
        onClose={vi.fn()}
        onOpenWhatsApp={onOpenWhatsApp}
      />
    );

    expect(screen.getByText('Informe para WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('María Pérez')).toBeInTheDocument();
    expect(screen.getByText('+57 ••••••4567')).toBeInTheDocument();
    expect(screen.getByText('Qué pasó')).toBeInTheDocument();
    expect(screen.getByText('Estado actual')).toBeInTheDocument();
    expect(screen.getByText('Qué sigue')).toBeInTheDocument();
    expect(screen.getByText('GUIA-123456')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Abrir WhatsApp' });
    expect(link).toHaveAttribute('href', preview.whatsappUrl);
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.click(link);
    expect(onOpenWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('explica el bloqueo de teléfono y permite reintentar sin abrir WhatsApp', () => {
    const onRetry = vi.fn();

    render(
      <OrderWhatsAppPreview
        open
        error="La orden no tiene un celular válido del cliente."
        onClose={vi.fn()}
        onRetry={onRetry}
        onOpenWhatsApp={vi.fn()}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La orden no tiene un celular válido del cliente.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Intentar nuevamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Abrir WhatsApp' })).not.toBeInTheDocument();
  });
});
