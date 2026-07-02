# Plan técnico - Módulo POS / Ventas físicas

## Estado

Rama de trabajo:

```txt
feature/pos-ventas-fisicas
```

Objetivo general:

Implementar un módulo profesional de ventas físicas para que la tienda pueda vender desde el local usando el mismo sistema administrativo, inventario por sedes, facturación electrónica y reportes del proyecto.

Este módulo debe quedar listo para producción, no como una prueba aislada.

---

## 1. Alcance del módulo

El módulo POS permitirá registrar ventas presenciales desde una sede física.

Debe cubrir:

- Venta rápida desde mostrador.
- Búsqueda de productos por nombre, SKU o código de barras.
- Selección automática o manual de sede.
- Control de inventario por sede.
- Métodos de pago físicos.
- Descuentos autorizados.
- Facturación electrónica si está activa.
- Comprobante de venta.
- Registro del vendedor/cajero.
- Base para caja y módulo financiero.

No se debe implementar todavía el cierre de caja completo dentro de esta fase. El POS debe quedar preparado para integrarse con caja en la siguiente rama.

---

## 2. Decisión arquitectónica

La venta física no debe manejarse como una entidad totalmente separada de las órdenes online.

Decisión recomendada:

```txt
Usar Order como documento principal de venta.
```

Motivo:

- Ya existe lógica de órdenes.
- Ya existe integración con inventario.
- Ya existe integración con facturación electrónica.
- Ya existe administración de órdenes.
- Se evita duplicar reportes y estados.

Se debe ampliar `Order` con campos que permitan distinguir el origen:

```js
source: 'online' | 'pos' | 'admin'
channel: 'web' | 'physical_store' | 'manual'
saleType: 'online_order' | 'pos_sale'
```

Para ventas físicas:

```txt
source = pos
channel = physical_store
saleType = pos_sale
```

---

## 3. Flujo de venta física

Flujo base:

```txt
1. Cajero abre pantalla POS.
2. Sistema detecta o solicita sede activa.
3. Cajero busca producto.
4. Sistema muestra disponibilidad real en la sede.
5. Cajero agrega producto a la venta.
6. Cajero define cantidad.
7. Sistema valida stock disponible.
8. Cajero selecciona método de pago.
9. Sistema calcula subtotal, descuentos, impuestos y total.
10. Cajero confirma venta.
11. Backend crea Order con source = pos.
12. Backend descuenta inventario inmediatamente.
13. Backend registra movimiento de inventario tipo sale.
14. Backend marca la orden como paid.
15. Si facturación electrónica está activa, genera factura.
16. Frontend muestra comprobante.
```

---

## 4. Estados recomendados

Para una venta POS pagada en el momento:

```txt
Order.status = paid o delivered
Order.payment.status = paid
Order.fulfillmentStatus = delivered
```

Decisión inicial recomendada:

```txt
status: paid
payment.status: paid
fulfillmentStatus: delivered
```

Motivo:

- La venta física se paga y entrega en el momento.
- No debe pasar por estados online como pending, processing o shipped.
- Debe quedar clara para reportes.

---

## 5. Inventario

La venta física debe descontar inventario de forma inmediata.

Reglas:

- Solo se puede vender stock disponible en la sede seleccionada.
- Disponible = stock - reservedStock.
- No se debe vender si la cantidad solicitada supera disponible.
- Debe registrar movimiento de inventario.
- Debe afectar `InventoryStock`.
- Debe dejar trazabilidad por vendedor, sede y orden.

Movimiento recomendado:

```txt
type: sale
reason: Venta física POS
source: pos
order: orderId
branch: branchId
```

La venta física no necesita reserva previa porque la operación es inmediata.

---

## 6. Pagos

El POS debe permitir pagos físicos.

Métodos iniciales:

- Efectivo.
- Transferencia.
- Tarjeta/datáfono.
- Mixto.

Estructura sugerida dentro de `Order.payment`:

```js
payment: {
  provider: 'pos',
  providerLabel: 'Venta física',
  status: 'paid',
  method: 'cash' | 'transfer' | 'card' | 'mixed',
  methodLabel: 'Efectivo' | 'Transferencia' | 'Tarjeta' | 'Pago mixto',
  amount: total,
  paidAt: Date,
  receivedAmount: Number,
  changeAmount: Number,
  splitPayments: []
}
```

Para pago mixto:

```js
splitPayments: [
  { method: 'cash', amount: 50000 },
  { method: 'transfer', amount: 30000 }
]
```

---

## 7. Descuentos

El POS debe permitir descuentos, pero con control.

Reglas iniciales:

- Descuento por porcentaje.
- Descuento por valor fijo.
- Guardar motivo del descuento.
- Guardar usuario que autorizó si supera el límite permitido.

Campos sugeridos:

```js
discount: {
  type: 'none' | 'percent' | 'amount',
  value: Number,
  amount: Number,
  reason: String,
  authorizedBy: ObjectId | null
}
```

Regla profesional:

- Descuentos pequeños pueden hacerlos vendedores autorizados.
- Descuentos altos requieren permiso especial.

Permiso sugerido:

```txt
pos:discount:approve
```

---

## 8. Facturación electrónica

La venta POS debe poder generar factura electrónica si la configuración está activa.

Reglas:

- Si DIAN/Factus está activo, generar factura después de crear la venta pagada.
- Usar el servicio ya creado:

```txt
backend/services/electronicInvoiceAfterPaymentService.js
```

- El `paymentProvider` debe quedar como:

```txt
pos
```

- Si el cliente no quiere factura nominada, usar cliente consumidor final si aplica según configuración fiscal.

Pendiente de decisión:

- Definir datos mínimos de consumidor final.
- Definir si todas las ventas POS facturan electrónicamente o si habrá opción de factura/recibo.

---

## 9. Clientes

El POS debe permitir dos modos:

### Venta rápida

Cliente genérico:

```txt
Consumidor final
```

### Venta identificada

Cliente con datos:

- Nombre.
- Documento.
- Teléfono.
- Correo.

La venta identificada permitirá historial de compras por cliente.

---

## 10. Caja

Caja no se implementa completa en esta fase, pero POS debe quedar preparado.

Campos previstos en Order:

```js
cashSession: ObjectId | null
cashRegister: ObjectId | null
cashier: ObjectId
```

En esta fase se puede dejar `cashSession` como null si todavía no existe módulo de caja.

Cuando se implemente caja:

- La venta POS deberá exigir caja abierta.
- Cada venta deberá quedar asociada a una sesión de caja.
- Los pagos en efectivo alimentarán el cierre.

---

## 11. Backend requerido

Rutas sugeridas:

```txt
GET    /api/admin/pos/bootstrap
GET    /api/admin/pos/products?q=&branchId=
POST   /api/admin/pos/sales/preview
POST   /api/admin/pos/sales
GET    /api/admin/pos/sales/:id
POST   /api/admin/pos/sales/:id/receipt
```

### GET /bootstrap

Debe devolver:

- Sedes disponibles para el usuario.
- Sede predeterminada.
- Métodos de pago habilitados.
- Permisos POS del usuario.
- Configuración de facturación.

### GET /products

Debe buscar productos vendibles por:

- Nombre.
- SKU.
- Código de barras.

Debe devolver stock por sede y precio.

### POST /sales/preview

Debe calcular:

- Subtotal.
- Descuento.
- Impuestos.
- Total.
- Validación de stock.

No debe descontar inventario.

### POST /sales

Debe:

- Validar stock otra vez.
- Crear Order POS.
- Descontar inventario.
- Crear movimiento de inventario.
- Marcar pago como paid.
- Generar factura si aplica.
- Devolver comprobante.

---

## 12. Frontend requerido

Pantalla principal:

```txt
frontend/src/admin/pos/PosSalesPage.jsx
```

Componentes sugeridos:

```txt
frontend/src/admin/pos/components/PosProductSearch.jsx
frontend/src/admin/pos/components/PosCart.jsx
frontend/src/admin/pos/components/PosPaymentPanel.jsx
frontend/src/admin/pos/components/PosCustomerPanel.jsx
frontend/src/admin/pos/components/PosSaleSummary.jsx
frontend/src/admin/pos/components/PosReceiptModal.jsx
```

API frontend:

```txt
frontend/src/admin/api/adminPosApi.js
```

---

## 13. Permisos administrativos

Permisos sugeridos:

```txt
pos:view
pos:sell
pos:discount
pos:discount:approve
pos:refund
pos:receipt
pos:settings
```

Para esta primera fase mínimos:

```txt
pos:view
pos:sell
pos:discount
pos:receipt
```

---

## 14. Validaciones de producción

El backend debe validar siempre:

- Usuario autenticado.
- Permiso `pos:sell`.
- Sede válida y activa.
- Usuario con acceso a la sede.
- Producto activo.
- Stock disponible en la sede.
- Cantidad mayor a cero.
- Precio válido.
- Descuento permitido.
- Método de pago válido.
- Total consistente.
- No confiar en totales enviados por frontend.

---

## 15. Errores controlados

Errores esperados:

```txt
POS_BRANCH_REQUIRED
POS_BRANCH_NOT_FOUND
POS_BRANCH_NOT_ALLOWED
POS_PRODUCT_NOT_FOUND
POS_PRODUCT_INACTIVE
POS_STOCK_NOT_AVAILABLE
POS_INVALID_PAYMENT_METHOD
POS_INVALID_TOTAL
POS_DISCOUNT_NOT_ALLOWED
POS_SALE_CREATE_ERROR
```

Cada error debe tener mensaje claro para el usuario.

---

## 16. Reportes futuros

El POS debe alimentar después:

- Ventas por día.
- Ventas por sede.
- Ventas por cajero.
- Ventas por método de pago.
- Productos más vendidos en tienda física.
- Utilidad por venta.
- Cierre de caja.
- Módulo financiero.

---

## 17. Pruebas mínimas

Scripts mínimos:

```txt
backend/scripts/testAdminPosBootstrap.js
backend/scripts/testAdminPosProductSearch.js
backend/scripts/testAdminPosSaleFlow.js
backend/scripts/testAdminPosStockValidation.js
```

Pruebas obligatorias:

- Crear venta POS con efectivo.
- Crear venta POS con transferencia.
- Crear venta POS con pago mixto.
- Bloquear venta sin stock.
- Bloquear venta sin sede.
- Bloquear descuento no autorizado.
- Confirmar descuento de inventario.
- Confirmar movimiento de inventario.
- Confirmar Order con source = pos.
- Confirmar factura electrónica si está activa.

---

## 18. Orden de implementación

### Paso 1

Crear plan técnico y confirmar alcance.

### Paso 2

Extender permisos administrativos para POS.

### Paso 3

Extender Order para soportar venta física.

### Paso 4

Crear servicio backend POS.

### Paso 5

Crear rutas backend POS.

### Paso 6

Crear scripts de prueba backend.

### Paso 7

Crear API frontend POS.

### Paso 8

Crear pantalla POS inicial.

### Paso 9

Integrar navegación admin.

### Paso 10

Probar flujo completo.

---

## 19. Fuera de alcance de esta fase

No se hará todavía:

- Cierre completo de caja.
- Reporte financiero completo.
- Devoluciones y cambios.
- Compras y proveedores.
- Responsive final completo del admin.
- Panel de despliegue.

Estos puntos se deben trabajar en ramas separadas.

---

## 20. Criterio de cierre de la rama

La rama `feature/pos-ventas-fisicas` se considera lista cuando:

- El POS permite crear una venta física real.
- La venta descuenta inventario correctamente.
- La venta queda registrada como Order con `source = pos`.
- El pago queda `paid`.
- Se registra método de pago.
- Se genera comprobante.
- Se integra con factura electrónica cuando esté activa.
- Hay scripts de prueba ejecutados correctamente.
- Backend y frontend arrancan sin errores.
- Existe documentación final de cierre.
