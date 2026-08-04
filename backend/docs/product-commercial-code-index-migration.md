# Migracion de unicidad de SKU y codigo de barras

Esta migracion activa exclusivamente los indices `uniq_product_sku_keys` y
`uniq_product_barcode_keys`. El arranque de produccion mantiene `autoIndex`
desactivado; la aplicacion no usa `syncIndexes()` ni administra otros indices.

## Orden obligatorio en produccion

1. Crear y verificar una copia de seguridad recuperable.
2. Programar una ventana controlada y pausar las escrituras de productos.
3. Ejecutar `audit`, que es el modo predeterminado y solo realiza lecturas.
4. Resolver manualmente todos los conflictos e invalidos del informe.
5. Repetir `audit` hasta obtener cero conflictos y cero documentos invalidos.
6. Ejecutar `backfill` con `--apply` y la confirmacion exacta de la base.
7. Ejecutar `verify`; debe confirmar que todas las claves almacenadas coinciden.
8. Ejecutar `create-indexes` con las mismas protecciones de escritura.
9. Ejecutar nuevamente `verify`, conservar el informe y reanudar las escrituras.

No se deben corregir duplicados automaticamente. El informe identifica `_id`,
nombre del producto, ubicacion, valor original y clave normalizada para que la
resolucion sea revisada por una persona.

## Modos

Desde `backend`:

```powershell
npm run product-code-indexes:migrate -- --mode=audit
npm run product-code-indexes:migrate -- --mode=verify
```

Los modos de escritura se ejecutan solamente despues de la aprobacion operativa:

```powershell
npm run product-code-indexes:migrate -- --mode=backfill --apply --confirm-database=NOMBRE_EXACTO
npm run product-code-indexes:migrate -- --mode=create-indexes --apply --confirm-database=NOMBRE_EXACTO
```

En produccion se exige ademas `--allow-production-migration`. Esa bandera no
reemplaza `--apply`, la confirmacion exacta de la base, la copia de seguridad ni
la revision humana.

`backfill` procesa lotes reanudables e idempotentes y modifica solamente
`skuKeys` y `barcodeKeys`. Cada escritura comprueba que los codigos comerciales
no hayan cambiado desde la auditoria; si detecta concurrencia se detiene y puede
reanudarse despues de repetir la auditoria. `create-indexes` se niega a operar con conflictos,
documentos invalidos, claves pendientes o definiciones incompatibles. Nunca
elimina, renombra o reconstruye indices existentes.

La URI y las credenciales de MongoDB no forman parte de los informes ni de los
errores del script.
