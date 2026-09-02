# POS Nivel Plus — Etapa 2

## Objetivo

Convertir el cierre de la venta POS en un cobro comercial verificable. La orden solo se crea después de validar inventario, descuento, medio de pago y una previsualización calculada por el servidor.

## Alcance implementado

- Efectivo recibido y cambio calculado.
- Transferencia con referencia bancaria obligatoria.
- Tarjeta/datáfono con terminal y autorización o voucher.
- Pago mixto con dos o más medios, distribución exacta y soporte por componente electrónico.
- Descuento porcentual o fijo con motivo comercial.
- Permiso `pos:discount` para aplicar descuentos.
- Permiso `pos:discount:approve` para superar el límite ordinario del 20%.
- Pantalla de revisión final antes de crear la orden.
- Una misma carga comercial para previsualizar y confirmar, evitando diferencias entre ambas operaciones.
- Comprobante POS con referencia y desglose de pagos mixtos.

## Reglas de integridad

1. El efectivo recibido no puede ser inferior al total cobrado.
2. Los pagos electrónicos deben coincidir exactamente con el total de la venta.
3. Un pago mixto no puede contener otro pago mixto y debe sumar exactamente el total.
4. Transferencia, tarjeta y otros medios exigen referencia verificable.
5. Todo descuento exige permiso y motivo.
6. Los descuentos superiores al 20% requieren permiso de aprobación.
7. La previsualización valida nuevamente stock, precios, cliente, pagos y descuento en el servidor.
8. La confirmación conserva la idempotencia y la transacción MongoDB de la Etapa 1.

## Validación automática

```bash
npm --prefix backend run test:pos-level-plus-stage1
npm --prefix backend run test:pos-level-plus-stage2
npm --prefix frontend run test:pos-level-plus-stage2
npm --prefix frontend run build
```

La integración transaccional de la Etapa 1 sigue siendo obligatoria en CI con MongoDB replica set:

```bash
npm --prefix backend run test:pos-level-plus-stage1-integration
npm --prefix backend run test:pos-level-plus-stage2-integration
```

## Fuera de esta etapa

- Cotizaciones y apartados.
- Crédito de tienda o cartera.
- Devoluciones desde POS.
- Modo sin conexión.
- Integración directa con hardware de datáfono.
