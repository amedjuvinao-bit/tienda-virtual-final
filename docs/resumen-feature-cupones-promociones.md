# Resumen técnico - Feature Cupones / Promociones

Rama cerrada: `feature/cupones-promociones`

## Objetivo

Implementar el módulo profesional de cupones, promociones y descuentos para la tienda virtual, conectado con el checkout, el panel administrativo, las órdenes y la trazabilidad de usos.

## Alcance construido

### Backend

Se agregó el backend completo para cupones:

- Modelo `Coupon`.
- Modelo `CouponRedemption`.
- Servicio `couponService`.
- Rutas administrativas `adminCoupons`.
- Rutas públicas `coupons`.
- Montaje de rutas en `backend/index.js`.
- Permisos administrativos en el catálogo de seguridad.

Capacidades soportadas:

- Cupón por porcentaje.
- Cupón por valor fijo.
- Cupón de envío gratis.
- Compra mínima.
- Tope máximo de descuento.
- Vigencia por fecha inicial y fecha final.
- Límite total de usos.
- Límite por cliente.
- Aplicación por todos los productos, productos específicos o categorías.
- Categorías incluidas y excluidas.
- Activar y desactivar cupón.
- Borrado lógico.
- Registro de redención del cupón.
- Control de duplicidad de códigos.

### Checkout

Se conectó el módulo al flujo real de compra:

- El cliente puede ingresar un código de cupón en checkout.
- El frontend valida contra `/api/coupons/validate`.
- El resumen de compra muestra descuento de producto y/o descuento de envío.
- El total final se recalcula con el descuento aplicado.
- Al crear la orden, el backend vuelve a validar el cupón.
- La orden guarda la información del cupón aplicado.
- El valor final del pago queda sincronizado con el descuento.
- Se registra la redención del cupón.
- Se agrega evento de trazabilidad en la orden.

### Panel administrativo

Se creó el módulo visual en administración:

- Ruta `/admin/cupones`.
- Opción en el menú administrativo.
- Listado de cupones.
- Filtros por búsqueda, tipo y estado.
- Crear cupón.
- Editar cupón.
- Activar y desactivar cupón.
- Eliminar cupón con confirmación visual global.
- Formulario en modal, no incrustado dentro de la página.
- Diseño ajustado al tema dinámico del panel admin.

### Códigos de cupón

Se corrigió la generación de códigos para evitar riesgos:

- Se eliminó el uso de marcas fijas como `ROSA`.
- Se eliminó el patrón predecible `CUP-0001`, `CUP-0002`.
- El botón `Auto` genera códigos públicos aleatorios como `CUP-7K9X-P2Q4`.
- Se evitan caracteres confusos como `O`, `I`, `0` y `1`.
- El código sigue siendo editable manualmente por el administrador.
- El seed de prueba también genera códigos seguros y genéricos.

### Seed de prueba

Se agregó script para crear un cupón activo temporal:

```bash
npm run seed:test-coupon
```

El script crea o actualiza un cupón de prueba con código seguro y genérico para validar checkout localmente.

## Scripts de validación

Se agregaron estos scripts:

```bash
npm run test:coupons-backend
npm run test:coupons-checkout
npm run test:coupons-admin
npm run test:coupons-module
```

## Resultado de cierre

La prueba integral del módulo quedó en:

```txt
Resumen cierre cupones -> OK: 14 WARN: 0 FAIL: 0
```

Validaciones cubiertas:

- Backend estructural.
- Checkout estructural.
- Admin estructural.
- Conexión a MongoDB.
- Crear cupón desde servicio admin.
- Listar y buscar cupón desde admin.
- Validar cupón en checkout.
- Calcular descuento.
- Editar cupón.
- Confirmar que checkout usa cambios editados.
- Desactivar cupón.
- Activar cupón.
- Registrar redención.
- Eliminar con borrado lógico.
- Confirmar que cupón eliminado ya no valida en checkout.
- Limpieza de datos temporales.

## Corrección final antes del cierre

Se eliminó la causa del warning de Mongoose por índice duplicado en `Coupon.code`, dejando un único índice compuesto/parcial para controlar unicidad de códigos no eliminados.

## Estado final

El módulo de cupones queda cerrado para esta etapa.

La siguiente rama recomendada es:

```bash
feature/facturacion-comprobantes
```

Esa rama debe iniciar el módulo de facturación interna y comprobantes, sin mezclarlo con cupones.
