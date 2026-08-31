# Cierre del módulo administrativo de carritos

Fecha de cierre: **5 de agosto de 2026**.

## Objetivo

El módulo `CarritosAdmin` permite supervisar oportunidades comerciales sin sustituir la actividad del comprador ni la autoridad del backend. Centraliza el resumen global, el listado operativo, el detalle canónico, la recuperación comercial, las acciones administrativas auditables y la relación explícita entre carrito y orden.

La interfaz utiliza la sesión administrativa legítima de `AuthContext` y el encabezado `Authorization: Bearer <token>`. Los permisos se verifican nuevamente en el backend; ocultar una acción en React nunca es la única barrera de seguridad.

## Ciclo de vida

El estado se calcula con la hora del servidor. `lastCustomerActivityAt` representa únicamente actividad real del comprador; una nota, etiqueta o edición administrativa actualiza `lastAdminActivityAt` y no rejuvenece el carrito. Los documentos históricos sin `lastCustomerActivityAt` utilizan `updatedAt` como fallback de lectura, sin migración masiva.

| Estado | Regla |
| --- | --- |
| Activo | Tiene unidades válidas y menos de 30 minutos desde la última actividad del cliente. |
| Inactivo | Tiene unidades y han transcurrido desde 30 minutos hasta menos de 24 horas. |
| Abandonado | Tiene unidades, han transcurrido 24 horas o más y no existe conversión explícita. |
| Recuperable | Es abandonado, tiene correo válido y no está convertido. |
| Vacío | No contiene unidades válidas. Prevalece sobre la antigüedad. |
| Convertido | Tiene `convertedOrderId` explícito y verificable. Nunca se infiere por coincidencia de correo. |

Los límites son exactos: a los 30 minutos pasa a inactivo y a las 24 horas pasa a abandonado o recuperable según el contacto disponible.

## Indicadores, vistas y filtros

El resumen se calcula en el backend sobre todos los registros que corresponden a la consulta, no sobre la página visible. Incluye:

- Carritos con productos.
- Activos.
- Abandonados.
- Recuperables.
- Valor total abandonado.
- Valor promedio de carritos con productos.

Las vistas rápidas son: todos, activos, abandonados, recuperables, alto valor, vacíos y convertidos. Los filtros combinables cubren búsqueda por cliente, correo, sesión o producto; ciclo de vida; cliente identificado o invitado; recuperable; rango de actividad; subtotal; unidades; intentos de recuperación; ordenamiento y paginación de 10, 20, 50 o 100 registros. La búsqueda escapa expresiones regulares y todos los ordenamientos agregan `_id` como desempate determinista.

La exportación seleccionada o filtrada produce CSV UTF-8 con BOM y escape de valores. No existe eliminación masiva.

## Endpoints administrativos

El router se monta como `/api/cart/admin` antes de las rutas dinámicas del carrito.

| Método | Ruta | Propósito | Permiso |
| --- | --- | --- | --- |
| GET | `/api/cart/admin/summary` | Resumen ejecutivo global. | `carts:view` |
| GET | `/api/cart/admin` | Listado filtrado, ordenado y paginado. | `carts:view` |
| GET | `/api/cart/admin/:sessionId` | Detalle con contraste canónico de productos e inventario. | `carts:view` |
| POST | `/api/cart/admin/export` | Exportación CSV filtrada o seleccionada. | `carts:export` |
| GET | `/api/cart/admin/export` | Exportación compatible con el contrato anterior. | `carts:export` |
| POST | `/api/cart/admin/follow-ups` | Seguimiento interno sobre carritos seleccionados. | `carts:recover` |
| POST | `/api/cart/admin/:sessionId/notes` | Nota interna con autor y fecha. | `carts:recover` |
| PUT | `/api/cart/admin/:sessionId/tags` | Etiquetas administrativas normalizadas. | `carts:recover` |
| POST | `/api/cart/admin/:sessionId/recovery-link` | Generación de enlace firmado. | `carts:recover` |
| POST | `/api/cart/admin/:sessionId/recoveries` | Envío o registro idempotente de recuperación. | `carts:recover` |
| PATCH | `/api/cart/admin/:sessionId/items` | Actualización administrativa de artículos. | `carts:delete` |
| PUT | `/api/cart/admin/:sessionId` | Compatibilidad para actualización o vaciado. | `carts:delete` |
| DELETE | `/api/cart/admin/:sessionId` | Eliminación individual confirmada. | `carts:delete` |

El endpoint público `POST /api/cart/recovery/claim` consume la credencial de recuperación por encabezados y entrega un acceso de carrito rotado. No requiere una credencial administrativa.

## Permisos

- `carts:view`: resumen, listado y detalle.
- `carts:export`: exportación CSV.
- `carts:recover`: seguimiento, notas, etiquetas, enlaces y comunicaciones.
- `carts:delete`: cambios de artículos, vaciado y eliminación individual.

Las operaciones sensibles están registradas en el mapa canónico de rutas administrativas y pasan por autenticación, autorización y auditoría del backend.

## Recuperación segura

El enlace se firma mediante HMAC con `CART_ACCESS_SECRET`, queda limitado al identificador y sesión exactos del carrito y tiene expiración configurable entre 15 minutos y 7 días; el valor predeterminado es 48 horas. La credencial se guarda únicamente como hash y viaja en el fragmento de la URL, que el navegador elimina antes de continuar. El servidor la recibe mediante encabezados dedicados, valida firma, expiración, carrito y uso previo, y rota la credencial normal del carrito al reclamarla.

El envío de correo exige `carts:recover`, confirmación, correo válido y configuración activa. Tiene clave de idempotencia y una ventana de protección de 15 minutos para evitar duplicados. Si el correo no está disponible, el módulo sigue permitiendo copiar el enlace. Las pruebas utilizan un doble controlado y nunca contactan un proveedor real.

Cada intento registra fecha, canal, resultado y administrador responsable sin guardar ni registrar credenciales completas.

## Conversión explícita con órdenes

Al completar correctamente la creación protegida de una orden se ejecuta `markCartConverted` con la misma sesión transaccional. Se guardan `convertedOrderId` y `convertedAt`; los reintentos idempotentes pueden confirmar la misma relación, pero nunca reemplazarla por otra orden. Una creación fallida no marca conversión y el carrito se conserva como histórico.

La creación exige dos precondiciones emitidas por la validación estricta: `If-Match-Updated-At` y `X-Cart-Snapshot-Fingerprint`. La huella SHA-256 cubre producto, variante, atributos, cantidad, precio y tipo de entrega canónicos. El middleware vuelve a calcularla antes de entrar a la transacción; la transacción la compara otra vez contra el catálogo vigente y convierte el carrito con un filtro atómico que incluye documento, credencial, versión e items persistidos. Un cambio de pestaña, precio o catálogo responde `CART_VERSION_CONFLICT` y no crea orden, reserva, movimiento, pago ni factura. Después de la conversión, el carrito queda inmutable para las rutas públicas de escritura.

## Concurrencia

Las mutaciones exigen la versión exacta de `updatedAt`. La comparación y escritura se realizan con un filtro atómico. Una versión desactualizada responde `409 CART_WRITE_CONFLICT`; el panel informa el conflicto, recarga el detalle autoritativo y exige que el administrador repita la acción. No existe sobrescritura silenciosa.

## Archivos principales

Backend:

- `backend/models/Cart.js`
- `backend/routes/cartRoutes.js`
- `backend/routes/cartAdminRoutes.js`
- `backend/routes/orders.js` (marcación de conversión)
- `backend/services/cartAccessService.js`
- `backend/services/cartCanonicalValidationService.js`
- `backend/services/cartAdminOperationsService.js`
- `backend/services/cartRecoveryService.js`
- `backend/security/adminRoutePermissionMap.js`

Frontend:

- `frontend/src/admin/CarritosAdmin.jsx`
- `frontend/src/admin/CarritosAdmin.css`
- `frontend/src/admin/cartAdminApi.js`
- `frontend/src/context/CartContext.jsx`
- `frontend/src/utils/cartAccess.js`
- `frontend/src/utils/cartMutationConcurrency.js`
- `frontend/src/utils/cartRecoveryAccess.js`
- `frontend/src/config/apiBaseUrl.js`

## Pruebas y resultado final

Validación ejecutada antes del cierre:

- Operaciones administrativas: **29/29**.
- Montaje real de rutas administrativas: **9/9**.
- Acceso seguro al carrito: **14/14**.
- Concurrencia del carrito: **12/12**.
- Versión carrito–orden: **9/9** controles sin MongoDB y **30 carreras reales** registradas en Órdenes CI sobre replica set.
- Validación canónica: **15/15**.
- Creación autorizada de órdenes: **21/21**.
- Protección de Gracias: **11/11**.
- Autoridad de configuración de pago: **13/13**.
- Acceso público a pagos: **16/16**.
- Integridad de `paidAt`: **18/18**.
- Recuperación de inventario fallido: **13/13**.
- Webhook Wompi aislado: **6/6**.
- Suite frontend completa: **81/81** en **20/20** archivos.
- Build Vite: aprobado, **1977 módulos transformados**.
- Sintaxis backend: **335/335 archivos JS/CJS**.
- `git diff --check HEAD`: aprobado.

Todas las pruebas de integración utilizaron dobles controlados o MongoDB desconectado. No se contactaron Wompi, PayU, Factus, correo ni otros proveedores.

## Restricciones operativas y de seguridad

- El backend es la autoridad de productos, variantes, precios, cantidades e inventario.
- La interfaz nunca fabrica estadísticas ni deriva conversiones por correo.
- Los tokens no se guardan en texto plano en MongoDB ni se registran en consola.
- La recuperación no incluye credenciales administrativas y no autoriza otro carrito.
- La ausencia de correo no bloquea la supervisión ni la copia del enlace.
- No se ejecutó migración masiva; los documentos históricos conservan compatibilidad de lectura.
- No se crean órdenes desde el panel de carritos.
- No se elimina automáticamente un carrito convertido.
- `VITE_API_BASE_URL` es la única base de API del frontend; fuera de desarrollo debe estar configurada explícitamente.
- `CART_ACCESS_SECRET` debe ser independiente y tener al menos 32 caracteres en producción.
