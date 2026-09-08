# Finanzas Nivel Plus — Etapa 3

## Propósito

Esta etapa incorpora cartera y tesorería operativa al módulo de Finanzas. Su objetivo es anticipar cobros y pagos, controlar vencimientos y registrar abonos sobre obligaciones reales sin duplicar ventas ni gastos.

No sustituye un sistema de contabilidad legal, conciliación bancaria o cuentas contables. Los valores presentados son instrumentos operativos para la administración de la tienda.

## Fuentes de verdad

- **Cuentas por cobrar:** se derivan directamente de órdenes reales cuyo pago continúa en `pending_gateway` o `pending_manual`. No se crea una segunda colección de cartera.
- **Cuentas por pagar:** se derivan de gastos aprobados con condición `credit`. La aprobación continúa siendo el momento en que el gasto afecta la utilidad; los abonos posteriores solo reducen su saldo de tesorería.
- **Sedes:** todas las consultas y mutaciones conservan el alcance de sedes autorizado para el usuario administrativo.

## Flujo de un gasto a crédito

1. El solicitante selecciona **Crédito** e indica un vencimiento.
2. La solicitud sigue el mismo control de aprobación y presupuesto de etapas anteriores.
3. Al aprobarse, se abre un saldo por pagar por el valor completo.
4. Cada abono registra valor, método, fecha, referencia, administrador y versión.
5. Un abono parcial deja el estado `partial`; el último abono deja el estado `paid` y saldo cero.

Los abonos no vuelven a incrementar el gasto ni vuelven a consumir presupuesto.

## Controles de integridad

- El permiso `finance:treasury:manage` está separado del permiso de consulta.
- Los pagos no efectivos exigen una referencia verificable.
- El servidor impide valores negativos, pagos superiores al saldo y fechas futuras.
- Cada mutación exige la versión vigente del gasto.
- La llave idempotente evita descontar dos veces el mismo abono.
- Dos abonos simultáneos compiten por la misma versión; solo uno puede confirmarse.
- Una cuenta con abonos no puede anularse hasta que exista un flujo formal de reversión o conciliación.
- El historial del gasto conserva cada abono con actor, fecha, valor y referencia.

## Panel administrativo

El bloque **Cartera y vencimientos** se integra en la página existente de Finanzas y muestra:

- total por cobrar;
- total por pagar;
- saldos vencidos;
- flujo neto proyectado para los próximos 30 días;
- órdenes pendientes de cobro;
- cuentas pendientes de pago y acceso al registro de abonos según permisos.

La interfaz usa las variables del tema administrativo, no incorpora barras laterales nuevas y se adapta a escritorio y móvil.

## Migración de índices

La migración es aditiva y en modo lectura por defecto:

```bash
npm --prefix backend run migrate:finance-treasury-indexes
```

Para crear los índices en un entorno autorizado:

```bash
npm --prefix backend run migrate:finance-treasury-indexes -- --apply-finance-treasury-index-migration
```

En producción también se exige:

```text
--confirm-production-finance-treasury-index-migration
```

La migración cubre un índice para cuentas por pagar en `financeexpenses` y otro para pagos pendientes en `orders`. No elimina ni renombra datos.

## Validación

```bash
npm --prefix backend run test:finance-level-plus-stage3
npm --prefix frontend run test:finance-level-plus-stage3
```

La integración Mongo debe ejecutarse únicamente contra una base aislada cuyo nombre comience por `finance_stage3_ci`:

```bash
FINANCE_STAGE3_MONGO_URI=mongodb://127.0.0.1:27017/finance_stage3_ci \
  npm --prefix backend run test:finance-level-plus-stage3-integration
```

En Windows CMD:

```bat
set FINANCE_STAGE3_MONGO_URI=mongodb://127.0.0.1:27017/finance_stage3_ci&& npm --prefix backend run test:finance-level-plus-stage3-integration
```

CI ejecuta los contratos de las Etapas 0 a 3, las pruebas visuales/API, las migraciones en modo seguro, la compilación y la integración aislada con MongoDB 7.
