# Finanzas Nivel Plus — Etapa 2

## Objetivo

Incorporar planificación presupuestal mensual sin sustituir los hechos financieros validados en las etapas anteriores. Los presupuestos se organizan por sede, centro de costo y tipo de gasto; el consumo siempre se calcula desde las solicitudes y pagos reales de `FinanceExpense`.

## Conceptos

- **Asignado:** límite activo configurado para el mes.
- **Comprometido:** solicitudes pendientes que todavía no afectan la utilidad.
- **Ejecutado:** gastos aprobados y pagados que sí afectan la utilidad.
- **Disponible:** asignado menos comprometido y ejecutado.
- **Alerta:** exposición igual o superior al umbral configurado.
- **Exceso:** exposición superior al límite.

Los registros anteriores que no tengan centro de costo permanecen válidos. Se muestran como no asignados y pueden seguir su flujo normal para preservar compatibilidad.

## Aprobación controlada

Antes de aprobar, el servidor vuelve a leer el presupuesto y los gastos del periodo. Un bloqueo atómico y temporal serializa las aprobaciones del mismo presupuesto, de modo que dos decisiones simultáneas no puedan gastar el mismo saldo.

Si no existe presupuesto o el pago supera el límite:

1. La aprobación normal se rechaza.
2. Solo `finance:budgets:override` puede autorizar la excepción.
3. La justificación es obligatoria.
4. Actor, fecha, razón, resultado y versión quedan en la trazabilidad del gasto.

La anulación conserva el historial y retira automáticamente el valor ejecutado del siguiente cálculo, porque no se almacenan totales duplicados.

## Permisos

- `finance:view`: consulta presupuestos, centros y control mensual.
- `finance:budgets:manage`: crea o ajusta centros, límites y umbrales.
- `finance:budgets:override`: autoriza una aprobación sin presupuesto o por encima del límite.
- Los permisos de solicitud, aprobación y anulación de la Etapa 1 continúan independientes.

## Interfaz

El panel **Presupuesto mensual** se integra en Finanzas sin barras laterales nuevas ni colores ajenos al tema. Presenta una franja continua con asignado, comprometido, ejecutado y disponible, seguida de líneas de avance por centro. La configuración usa un modal centrado y responsivo; no utiliza diálogos nativos del navegador.

El formulario de gasto permite asignar un centro de costo. Una excepción presupuestal se explica dentro del mismo modal de aprobación y el botón permanece bloqueado mientras falte permiso o justificación.

## Índices y migración

La migración añade siete índices canónicos en `financecostcenters`, `financebudgets` y `financeexpenses`. No elimina documentos ni índices:

```bash
npm --prefix backend run migrate:finance-budget-indexes
npm --prefix backend run migrate:finance-budget-indexes -- --apply-finance-budget-index-migration
```

En producción también exige:

```bash
--confirm-production-finance-budget-index-migration
```

## Validación

```bash
npm --prefix backend run test:finance-level-plus-stage0
npm --prefix backend run test:finance-level-plus-stage1
npm --prefix backend run test:finance-level-plus-stage2
npm --prefix frontend run test:finance-level-plus-stage0
npm --prefix frontend run test:finance-level-plus-stage1
npm --prefix frontend run test:finance-level-plus-stage2
npm --prefix frontend run build
```

La integración real solo acepta bases aisladas cuyo nombre comience por `finance_stage2_ci`:

```bash
FINANCE_STAGE2_MONGO_URI="mongodb://127.0.0.1:27017/finance_stage2_ci" npm --prefix backend run test:finance-level-plus-stage2-integration
```

El flujo de CI crea MongoDB temporal, aplica la migración aditiva y valida aislamiento por sede, contabilidad del presupuesto, excepciones, revisiones vencidas y aprobaciones simultáneas sin tocar datos reales.

## Fuera de alcance

Esta etapa no genera asientos contables, cuentas por pagar, conciliación bancaria ni estados financieros legales. Esos procesos requieren etapas posteriores y no se infieren a partir del presupuesto operativo.
