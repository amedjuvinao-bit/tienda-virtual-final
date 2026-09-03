# Caja Nivel Plus — Etapa 0

## Objetivo

Cerrar los riesgos de integridad del módulo de Caja antes de ampliar sus funciones. Esta etapa mantiene el flujo actual de apertura, movimientos, ventas POS, cierre y reporte, pero fija contratos que evitan cierres inconsistentes y cambios silenciosos en el histórico.

## Contratos establecidos

- La apertura acepta un monto inicial de cero, pero rechaza montos negativos o no numéricos.
- Los movimientos manuales exigen un valor entero positivo y conservan su signo según el tipo de movimiento.
- El cierre exige el efectivo contado; un campo vacío ya no se convierte en cero.
- El cierre trabaja con la versión devuelta por el recálculo atómico y evita el conflicto falso que impedía cerrar una caja válida.
- Las cajas cerradas o anuladas no se recalculan durante una consulta. Sus valores históricos permanecen estables.
- Un reembolso posterior al cierre queda señalado para ajuste operativo y no declara una conciliación inexistente.
- La sede y la terminal solo pueden tener una caja abierta, protegido por un índice único parcial.
- Los códigos de caja usan la fecha operativa de Colombia.
- El retiro de efectivo forma parte del formulario React; la pantalla activa ya no modifica el DOM mediante intervalos.

## Índices canónicos

La definición compartida entre el modelo y la migración incluye:

| Índice | Propósito |
| --- | --- |
| `sessionCode_1` | Código único de la sesión |
| `branch_1_cashRegisterCode_1_status_1` | Una caja abierta por sede y terminal |
| `branch_1_status_1_openedAt_-1` | Consulta operativa e histórica por sede |
| `cashier_1_openedAt_-1` | Historial por cajero |

La migración es de solo lectura por defecto. Para crear índices se requiere el indicador explícito `--apply-cash-session-index-migration`; en producción también exige `--confirm-production-cash-session-index-migration`. No elimina índices ni documentos.

## Validación

```bash
npm --prefix backend run test:cash-level-plus-stage0
npm --prefix frontend run test:cash-level-plus-stage0
npm --prefix backend run migrate:cash-session-indexes
```

La integración usa exclusivamente una base aislada llamada `cash_stage0_ci`:

```bash
CASH_STAGE0_MONGO_URI="mongodb://127.0.0.1:27017/cash_stage0_ci?replicaSet=rs0" npm --prefix backend run test:cash-level-plus-stage0-integration
```

El flujo de CI levanta una instancia MongoDB temporal y ejecuta esa prueba sin tocar datos reales.

## Fuera de alcance

Esta etapa no incorpora arqueos ciegos, aprobaciones, turnos de cajero ni ajustes posteriores al cierre. Esas capacidades se construyen sobre estos contratos en las siguientes etapas.
