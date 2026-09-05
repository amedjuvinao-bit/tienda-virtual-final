# Caja Nivel Plus - Etapa 3

La Etapa 3 incorpora conciliación automática por sesión y un control consolidado de jornada para supervisores. Reutiliza las ventas POS y medios de pago reales; no crea un libro paralelo ni confía en totales enviados por el navegador.

## Conciliación por sesión

Al cerrar una caja, el servidor conserva una instantánea auditable que valida:

- ventas netas frente a la suma de medios de pago;
- efectivo esperado frente a base inicial, ventas en efectivo, ingresos y salidas;
- efectivo contado frente al esperado y la tolerancia configurada;
- movimientos y arqueos pendientes de decisión.

Los cierres anteriores siguen siendo compatibles: si no tienen instantánea, el servidor genera su lectura de conciliación sin alterar el documento histórico.

## Control de jornada

La vista de supervisión permite consultar hoy o los últimos siete días y consolida:

- cajas abiertas y cerradas;
- órdenes y ventas netas;
- efectivo esperado, contado, faltantes y sobrantes;
- efectivo, transferencias, tarjetas, pagos mixtos y otros;
- alertas de integridad y revisiones pendientes;
- detalle por caja y cajero.

El cajero no recibe este consolidado monetario y la conciliación de una caja abierta permanece protegida durante el conteo ciego.
La misma protección se conserva dentro del POS: los importes protegidos se muestran como `Oculto`, las respuestas posteriores a una venta no revelan el esperado y el acceso a `Jornada` queda reservado a supervisores.

## Verificación

```bash
npm --prefix backend run test:cash-level-plus-stage3
npm --prefix frontend run test:cash-level-plus-stage3
```

La integración usa exclusivamente una base desechable llamada `cash_stage3_ci`:

```bash
CASH_STAGE3_MONGO_URI='mongodb://127.0.0.1:27017/cash_stage3_ci?replicaSet=rs0' npm --prefix backend run test:cash-level-plus-stage3-integration
```
