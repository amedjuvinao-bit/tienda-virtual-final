# Finanzas Nivel Plus — Etapa 1

## Objetivo

Convertir el registro manual de gastos en un flujo financiero controlado. La Etapa 0 continúa siendo la fuente de verdad para ingresos, devoluciones, costos históricos, caja y alcance por sede; esta etapa añade solicitud, aprobación, rechazo, corrección, anulación e historial de decisiones.

## Flujo del gasto

```text
Solicitud nueva → Pendiente → Aprobado
                          ↘ Rechazado → Corregido y reenviado → Pendiente
Aprobado / Pendiente / Rechazado → Anulado con motivo
```

- Una solicitud nueva queda `pending` y no modifica la utilidad.
- Una aprobación convierte el gasto en `paid`; solo desde ese momento se reconoce en los resultados.
- Un rechazo conserva el registro y exige una explicación. El solicitante puede corregirlo y reenviarlo sin perder el historial.
- Un gasto aprobado queda inmutable. Si debe reversarse, se anula con motivo en lugar de reescribir el hecho financiero.
- Los gastos anulados no afectan la utilidad, pero permanecen disponibles en el historial y en la exportación de auditoría.

## Gobierno y segregación

- `finance:expenses`: crear y corregir solicitudes.
- `finance:expenses:approve`: aprobar o rechazar.
- `finance:expenses:cancel`: anular justificadamente.
- `finance:export`: exportar el reporte financiero y su trazabilidad.

La segregación impide que un solicitante común revise su propio gasto. El propietario puede resolver una solicitud propia únicamente como excepción operativa: debe escribir una justificación y el registro queda marcado con `selfApprovalOverride`.

## Integridad técnica

- Cada solicitud usa una clave idempotente ligada al actor para impedir duplicados por reintentos de red.
- Cada mutación exige `expectedRevision`. La revisión optimista evita que dos navegadores aprueben, rechacen o anulen simultáneamente una versión vencida.
- Cada transición conserva estado anterior, estado nuevo, actor, fecha, nota, versión y condición de excepción.
- Las sedes se validan nuevamente en el servidor. Una persona no puede leer ni decidir gastos fuera de su alcance.
- Rechazo y anulación requieren motivo obligatorio.
- La API sigue deshabilitando caché y el mapa central registra las decisiones sensibles en `AdminAuditLog`.

## Interfaz

La sección **Solicitudes y aprobaciones** presenta una sola franja con pendientes, aprobados, rechazados y anulados. Incluye filtro por estado, acciones según permisos, modales centrados para decidir y anular, y una ventana de trazabilidad por gasto. Todos los colores proceden de las variables configuradas en Apariencia.

## Índices

La migración es aditiva y no elimina índices ni documentos:

```bash
npm --prefix backend run migrate:finance-expense-indexes
npm --prefix backend run migrate:finance-expense-indexes -- --apply-finance-expense-index-migration
```

En producción se exige además:

```bash
--confirm-production-finance-expense-index-migration
```

## Validación

```bash
npm --prefix backend run test:finance-level-plus-stage0
npm --prefix backend run test:finance-level-plus-stage1
npm --prefix frontend run test:finance-level-plus-stage0
npm --prefix frontend run test:finance-level-plus-stage1
npm --prefix frontend run build
```

La integración usa exclusivamente una base cuyo nombre comienza por `finance_stage1_ci`:

```bash
FINANCE_STAGE1_MONGO_URI="mongodb://127.0.0.1:27017/finance_stage1_ci" npm --prefix backend run test:finance-level-plus-stage1-integration
```

El flujo `finance-ci.yml` levanta MongoDB temporal, ejecuta las regresiones de Etapa 0 y valida concurrencia, idempotencia, segregación y contabilización de Etapa 1 sin tocar datos reales.

## Fuera de alcance

Presupuestos, centros de costo, cuentas por pagar, cierres contables y exportaciones masivas corresponden a etapas posteriores. Esta etapa no sustituye la contabilidad legal ni genera asientos contables.
