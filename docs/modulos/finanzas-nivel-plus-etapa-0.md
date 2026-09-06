# Finanzas Nivel Plus — Etapa 0

## Objetivo

Establecer una base financiera segura y verificable antes de ampliar el módulo. La etapa conserva las funciones existentes de resumen, ventas, utilidad, caja, gastos y exportación, pero corrige el alcance por sede y la formación de los hechos financieros.

## Contratos establecidos

- Cada consulta financiera respeta las sedes asignadas al usuario. Solo los perfiles con alcance global pueden consolidar todas las sedes.
- Una sede enviada manualmente fuera del alcance autorizado se rechaza; no se usa únicamente como filtro visual.
- Los gastos se crean, actualizan y anulan dentro del alcance autorizado. La sede y su nombre se obtienen del registro oficial, no de datos enviados por el navegador.
- Consultar, registrar gastos y exportar exige permisos financieros específicos. Las mutaciones y exportaciones quedan cubiertas por el mapa central de auditoría.
- La pantalla oculta las acciones de gasto y exportación cuando el usuario no posee el permiso correspondiente, manteniendo una vista de solo lectura coherente con el servidor.
- Las ventas se reconocen por la fecha efectiva de pago. Una operación POS no se presume pagada solo por su origen.
- Los pagos mixtos se distribuyen entre sus métodos reales.
- El ingreso se presenta como venta bruta menos devoluciones. Los reembolsos procesados y las notas crédito validadas equivalentes se descuentan una sola vez.
- El costo de venta se toma primero del movimiento histórico de inventario. El costo actual del producto solo se usa como estimación cuando falta ese histórico.
- Una devolución revierte el costo asociado y permite calcular ingreso neto, costo neto y utilidad bruta neta del periodo.
- Las respuestas financieras deshabilitan caché y los errores internos no se exponen al navegador.

## Fuentes autoritativas

| Hecho | Fuente principal | Regla |
| --- | --- | --- |
| Venta pagada | `Order.payment.paidAt` | Usa aprobación o creación solo como compatibilidad histórica |
| Medio de pago | `Order.payment.splitPayments` | Conserva cada componente del pago mixto |
| Devolución | `OrderRefund` procesado | Se reconoce en la fecha de procesamiento |
| Nota crédito | `ElectronicInvoice.creditNotes` validada | Se reconoce en la fecha de validación y se concilia con el reembolso |
| Costo de venta | `InventoryMovement` tipo `sale_out` | Congela el costo correspondiente a la venta |
| Gasto manual | `FinanceExpense` | Guarda la sede oficial y el actor administrativo |

## Calidad del costo

El reporte de utilidad expone `costQuality` para distinguir:

- partidas con costo histórico;
- partidas estimadas con el costo actual del producto;
- partidas sin costo disponible.

La interfaz muestra una advertencia cuando el resultado incluye estimaciones o datos faltantes. Esto evita presentar una utilidad aproximada como si fuera certificada.

## Validación

```bash
npm --prefix backend run test:finance-level-plus-stage0
npm --prefix frontend run test:finance-level-plus-stage0
npm --prefix frontend run build
```

La integración usa exclusivamente una base aislada cuyo nombre comienza por `finance_stage0_ci`:

```bash
FINANCE_STAGE0_MONGO_URI="mongodb://127.0.0.1:27017/finance_stage0_ci" npm --prefix backend run test:finance-level-plus-stage0-integration
```

El flujo `finance-ci.yml` levanta una instancia MongoDB temporal y ejecuta la integración sin tocar datos reales.

## Fuera de alcance

Esta etapa no incorpora aprobaciones de gastos, cierres contables, exportaciones masivas ni un rediseño completo de la interfaz. Esas capacidades corresponden a las siguientes etapas del módulo.
