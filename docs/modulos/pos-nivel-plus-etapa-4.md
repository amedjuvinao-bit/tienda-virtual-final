# POS nivel Plus — Etapa 4

## Resultado

La Etapa 4 añade un cierre operativo profesional al POS mediante una vista de **Jornada** integrada en el centro operativo. La consulta no calcula cifras en el navegador: el servidor consolida Órdenes, pagos, reembolsos, facturas electrónicas, ventas en espera y la sesión de caja vigente, respetando la sede autorizada del usuario.

## Alcance implementado

- Resumen por jornada actual, día de hoy o últimos siete días.
- Venta bruta, descuentos, reembolsos, venta neta, unidades y ticket promedio.
- Desglose de efectivo, transferencia, tarjeta, pagos mixtos y otros medios.
- Conciliación de la caja abierta: base, efectivo vendido, entradas, salidas y efectivo esperado.
- Alertas por caja obligatoria cerrada, ventas sin sesión, facturación fallida o pendiente, reembolsos sin conciliar y ventas activas en espera.
- Descarga CSV compatible con Excel.
- Enlaces directos a Caja, Finanzas, Facturación y Órdenes para ejecutar las acciones especializadas.
- Límites de acceso por permiso `pos:view` y por sedes autorizadas.
- Periodos diarios calculados con zona horaria `America/Bogota`.

## Decisiones de arquitectura

1. **Autoridad del servidor:** el cliente recibe una respuesta marcada como `serverAuthoritative`; no reconstruye totales desde el carrito ni desde almacenamiento local.
2. **Sin duplicar módulos:** Jornada supervisa. Caja sigue administrando aperturas, movimientos y cierres; Finanzas conserva el análisis contable; Órdenes gestiona anulaciones, devoluciones y reembolsos; Facturación gestiona la emisión fiscal.
3. **Consulta escalable:** las métricas y medios de pago usan agregaciones MongoDB sobre índices existentes de sede y fecha. No se descarga el historial completo al navegador.
4. **Pagos mixtos:** cada componente se asigna a su medio real mediante `splitPayments`.
5. **Conciliación coherente:** el efectivo de caja utiliza la misma lógica de ventas y reembolsos confirmados que el módulo Caja.

## Archivos principales

- `backend/services/posShiftReportService.js`
- `backend/routes/adminPos.js`
- `frontend/src/admin/pos/PosShiftReportPanel.jsx`
- `frontend/src/admin/pos/posShiftReportModel.js`
- `frontend/src/admin/pos/PosOperationsPanel.jsx`

## Validación

```bash
npm --prefix backend run test:pos-level-plus-stage4
npm --prefix frontend run test:pos-level-plus-stage4
npm --prefix frontend run build
```

La integración real requiere una base Mongo aislada cuyo nombre sea exactamente `pos_stage4_ci`:

```bash
set POS_STAGE4_MONGO_URI=mongodb://127.0.0.1:27017/pos_stage4_ci
npm --prefix backend run test:pos-level-plus-stage4-integration
```

La prueba elimina únicamente esa base aislada al terminar. Nunca debe apuntarse a desarrollo ni a producción.

## Prueba manual en el panel

1. Abrir `/admin/pos` y seleccionar una sede con acceso.
2. Abrir o verificar `CAJA POS` desde el módulo Caja.
3. Registrar una venta en efectivo y otra con tarjeta o pago mixto.
4. Guardar una venta en espera.
5. En el bloque **Continuidad de venta**, pulsar **Jornada**.
6. Verificar que ventas, unidades y medios de pago coincidan con las operaciones realizadas.
7. Confirmar que la ecuación de efectivo muestre base + ventas en efectivo + entradas - salidas = esperado.
8. Cambiar entre Jornada actual, Hoy y Últimos 7 días.
9. Descargar el CSV y comprobar que abre con columnas separadas en Excel.
10. Resolver o revisar cualquier alerta usando su enlace al módulo responsable.

## Fuera de alcance

- Conexión directa con un datáfono físico. Requiere seleccionar proveedor, modelo de terminal, protocolo/API y condiciones comerciales.
- Operación sin conexión a internet.
- Sustituir los reportes contables y fiscales completos de Finanzas o Facturación.
