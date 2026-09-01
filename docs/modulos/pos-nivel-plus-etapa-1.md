# POS Nivel Plus — Etapa 1

## Objetivo

Blindar la operación base de POS antes de ampliar su interfaz o sus funciones comerciales. Esta etapa evita ventas duplicadas, limita la operación por sede, protege la caja ante concurrencia y separa el recibo POS de la factura electrónica.

## Cambios terminados

- Cada venta exige `Idempotency-Key` y conserva la misma clave durante un reintento del mismo intento de venta.
- La clave, el cajero y el contenido de la venta forman una huella estable. Una clave reutilizada con datos distintos responde con conflicto.
- El bloqueo idempotente, la orden, el descuento de inventario y la actualización de caja se confirman dentro de la misma transacción MongoDB.
- Un reintento terminado recupera la orden original en vez de crear otra venta.
- Productos, ventas, recibos y cajas quedan limitados a las sedes asignadas al usuario.
- `canSell` es obligatorio para vender; manager, admin y owner pueden supervisar cajas dentro de su alcance.
- Un cajero sin supervisión solo puede mover o cerrar su propia caja.
- La caja usa control optimista de versión y devuelve conflicto si dos operaciones intentan modificarla al mismo tiempo.
- La apertura simultánea de la misma caja se traduce a un conflicto operativo claro.
- El recibo POS se puede consultar, imprimir o enviar sin emitir una factura electrónica.
- La factura electrónica se genera únicamente mediante la acción explícita del módulo de facturación y su permiso `billing:create`.
- El cumplimiento posterior de la orden usa el mecanismo durable y recuperable de postcommit.
- Las rutas sensibles de venta, recibo y caja están incorporadas al mapa global de permisos y auditoría.

## Validación automatizada

Ejecutar:

```bash
npm --prefix backend run test:pos-level-plus-stage1
```

La prueba cubre idempotencia, separación por cajero, alcance por sede, concurrencia de caja, separación recibo/factura, postcommit y contratos de permisos. El workflow `.github/workflows/pos-ci.yml` también compila el frontend y conserva las pruebas base del POS.

CI también ejecuta `test:pos-level-plus-stage1-integration` contra una base MongoDB aislada con replica set. Allí comprueba transacciones reales, doce intentos simultáneos, control de versión de caja, caja abierta única e índices físicos de idempotencia.

## Índices requeridos al desplegar

Antes de habilitar esta etapa en una base existente, revisar y aplicar la migración canónica ya incluida en el proyecto:

```bash
npm --prefix backend run migrate:idempotency-key-indexes
npm --prefix backend run migrate:idempotency-key-indexes -- --apply-idempotency-key-index-migration
```

En producción, el segundo comando también requiere `--confirm-production-idempotency-key-index-migration`. La migración crea o corrige únicamente los índices declarados y primero puede revisarse en modo `dry-run`.

## Límite de esta etapa

La Etapa 1 no rediseña todavía la pantalla de venta ni agrega devoluciones, apartados, cotizaciones o crédito. Esas mejoras dependen de esta base segura y se implementan en las siguientes etapas.
