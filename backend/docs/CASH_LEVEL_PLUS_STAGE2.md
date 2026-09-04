# Caja Nivel Plus — Etapa 2

La Etapa 2 incorpora arqueo por denominaciones, control de diferencias y revisión de supervisor sin modificar los contratos de apertura, movimientos o cierre simple existentes.

## Reglas operativas

- El servidor vuelve a calcular cada subtotal y el total; no confía en valores calculados por el navegador.
- Las denominaciones admitidas son 100.000, 50.000, 20.000, 10.000, 5.000, 2.000, 1.000, 500, 200, 100 y 50 COP.
- Una diferencia absoluta dentro de `CASH_VARIANCE_TOLERANCE` se puede cerrar normalmente.
- Una diferencia superior a la tolerancia enviada por un cajero crea una revisión pendiente y mantiene la caja abierta.
- Mientras exista una revisión pendiente, se bloquean nuevas ventas POS, movimientos manuales y segundos intentos de cierre.
- Un supervisor puede aprobar y cerrar, o rechazar para habilitar un nuevo conteo. Toda decisión conserva identidad, fecha y observación.
- El conteo ciego sigue ocultando efectivo esperado y diferencia al cajero mientras la caja permanezca abierta.

## Configuración

`CASH_VARIANCE_TOLERANCE` expresa pesos colombianos enteros. El valor predeterminado es `1000`.

## Verificación

```bash
npm --prefix backend run test:cash-level-plus-stage2
npm --prefix frontend run test:cash-level-plus-stage2
```

La integración requiere una base MongoDB transaccional dedicada y desechable:

```bash
CASH_STAGE2_MONGO_URI='mongodb://127.0.0.1:27017/cash_stage2_ci?replicaSet=rs0' npm --prefix backend run test:cash-level-plus-stage2-integration
```
