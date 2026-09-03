# Caja Nivel Plus — Etapa 1

## Objetivo

Convertir el cierre básico de Caja en un control operativo profesional. La Etapa 1 agrega arqueo ciego para cajeros, separación efectiva entre operador y supervisor, aprobación de salidas y una trazabilidad visible y auditable, conservando todos los contratos de integridad de la Etapa 0.

## Flujo operativo

### Cajero

- Abre y opera únicamente la caja que tiene asignada.
- Ve cantidades de órdenes, pero no recibe el efectivo esperado, el total vendido, los medios de pago ni la diferencia mientras la caja está abierta.
- Registra ingresos de efectivo directamente.
- Envía salidas, gastos, retiros y ajustes negativos a aprobación.
- No puede aprobar su propia solicitud.
- No puede cerrar mientras exista una solicitud pendiente.
- Ingresa el efectivo contado sin precarga del sistema.
- Después del cierre recibe el esperado, el contado y la diferencia definitivos.

### Supervisor

Los roles `owner`, `admin` y `manager` tienen autoridad de supervisión dentro de las sedes que pueden operar.

- Conservan la vista completa de cifras durante la jornada.
- Pueden aprobar o rechazar solicitudes pendientes.
- Al rechazar deben registrar un motivo.
- Cada decisión conserva responsable, rol, fecha y observación.
- Una aprobación aplica el movimiento una sola vez; un rechazo no modifica el efectivo esperado.

## Integridad y compatibilidad

- Los movimientos `pending` y `rejected` quedan fuera del cálculo de efectivo esperado.
- Los movimientos `approved`, `not_required` y los históricos sin estado de aprobación conservan su efecto.
- Una salida pendiente se valida contra el efectivo disponible al momento de aprobar, no al momento de solicitar. Así el cajero no puede inferir el esperado mediante mensajes de error.
- Las revisiones usan el control de versión optimista del modelo; dos decisiones simultáneas no pueden aplicarse juntas.
- Una caja cerrada no admite nuevas revisiones.
- El cierre se rechaza desde el servidor si existe al menos una solicitud pendiente, aunque se intente omitir la interfaz.
- La ruta de revisión usa el permiso `pos:sell`, valida sede y supervisor, y queda registrada por la auditoría administrativa global.

## API

```text
POST /api/admin/cash-sessions/:id/movements
POST /api/admin/cash-sessions/:id/movements/:movementId/review
POST /api/admin/cash-sessions/:id/close
```

Ejemplo de revisión:

```json
{
  "decision": "approve",
  "reviewNotes": "Soporte y efectivo verificados"
}
```

Para rechazar, `decision` debe ser `reject` y `reviewNotes` es obligatorio.

## Validación

```bash
npm --prefix backend run test:cash-level-plus-stage0
npm --prefix backend run test:cash-level-plus-stage1
npm --prefix frontend run test:cash-level-plus-stage0
npm --prefix frontend run test:cash-level-plus-stage1
npm --prefix frontend run build
```

La integración utiliza exclusivamente una base temporal llamada `cash_stage1_ci`:

```bash
CASH_STAGE1_MONGO_URI="mongodb://127.0.0.1:27017/cash_stage1_ci?replicaSet=rs0" npm --prefix backend run test:cash-level-plus-stage1-integration
```

En CI se levanta MongoDB de forma temporal, se ejecutan las decisiones concurrentes y se elimina la base aislada al terminar.

## Fuera de alcance

Esta etapa no incorpora todavía entrega formal de turno entre cajeros, bóveda central, denominaciones de billetes y monedas, depósitos bancarios ni reaperturas o ajustes contables posteriores al cierre. Esas capacidades pertenecen a las siguientes etapas de Caja Nivel Plus.
