# Arquitectura del módulo Órdenes

## Objetivo

El módulo se organiza por casos de uso y no por un único archivo central. Las rutas
declaran el contrato HTTP, los controladores traducen HTTP a comandos del dominio y
los servicios ejecutan reglas, transacciones e integraciones. Las fachadas públicas
mantienen compatibilidad mientras la implementación interna puede evolucionar.

## Fronteras

| Capa | Responsabilidad | No debe hacer |
| --- | --- | --- |
| `routes/` | Middleware, permisos y asociación endpoint-controlador | Consultas, transacciones o reglas del negocio |
| `controllers/` | Validar entrada HTTP y formar la respuesta | Duplicar máquinas de estado o lógica contable |
| `services/` | Casos de uso, políticas, idempotencia y transacciones | Depender de componentes React |
| `models/` | Esquemas, índices, hooks y persistencia canónica | Implementar flujos HTTP |
| `frontend/src/admin/orders/` | Estado de interfaz, presentación y accesibilidad | Decidir inventario, pagos o permisos |

Las fachadas estables incluyen `Order.js`, `orderAdminQueryService.js`,
`orderLogisticsService.js`, `orderReturnService.js`, `orderRefundService.js`,
`orderShippingIntegrationService.js`, `orderStatusTransitionService.js`,
`orderFulfillmentService.js`, `inventoryReservationService.js`,
`orderInventoryAllocationService.js`, `orderOperationalMonitoringService.js`,
`orderRefundAutomationService.js`, `paymentAttemptService.js`,
`manualPaymentConfirmationService.js` y `wompiWebhookIntegrityService.js`. Un
consumidor importa la fachada; no necesita conocer cómo se reparten sus módulos
internos.

`OrderEvent` y `OrderNote` se definen una sola vez en `backend/models`. Ninguna ruta,
controlador o servicio debe volver a registrar modelos Mongoose con esos nombres.

## Creación de una orden

1. El middleware limita frecuencia y exige un carrito autorizado.
2. El controlador normaliza el contrato HTTP.
3. El servicio de idempotencia impide convertir dos veces el mismo carrito.
4. La transacción valida precios e inventario, reserva saldo a favor y crea la orden.
5. Si la transacción falla, no queda una orden parcial ni un saldo consumido.
6. Facturación y efectos secundarios posteriores se programan después del commit.

La sede no forma parte de la autoridad del navegador. Para artículos físicos el
servidor selecciona de forma determinista sedes activas, habilitadas para inventario
y con disponibilidad de las variantes canónicas; la reserva queda limitada a esa
lista. Las órdenes digitales o de servicios usan la sede online configurada por el
servidor.

El orden de los middlewares de `POST /api/orders` es parte del contrato de seguridad:
`rateLimit`, `requireAuthorizedOrderCart`, `createOrder`.

## Estados, devoluciones y reembolsos

- Toda transición individual o masiva pasa por la misma máquina de estados.
- Las operaciones críticas de estado se ejecutan con sesión transaccional.
- Una devolución separa elegibilidad, inspección, cambio, reembolso y saldo a favor.
- Un reembolso coordina importe, inventario, registro financiero y evento sin escribir
  el estado directamente desde la ruta.
- Los reintentos usan claves o evidencia persistida; un webhook repetido no puede
  cobrar, liberar o reponer dos veces.

### Alcance administrativo multisede

- Listado, detalle y logística presentan únicamente asignaciones y envíos de las
  sedes autorizadas; los resúmenes globales se omiten cuando permitirían inferir
  cantidades, direcciones, incidencias o guías de otra sede.
- Una mutación global exige acceso a todas las sedes involucradas en la orden. Las
  operaciones de inventario respetan `canManageInventory` y las financieras o
  documentales respetan `canInvoice` en cada sede.
- `OrderReturn.items` todavía no conserva `branch` ni `allocationId`. Una misma línea
  puede estar distribuida entre varias sedes, por lo que un RMA parcial no se puede
  presentar sin falsear cantidades, seguimiento o resolución. Hasta versionar ese
  modelo, la lectura y toda mutación administrativa de devoluciones fallan cerradas
  si el usuario no tiene acceso a la orden completa.
- El cambio automático usa las sedes autorizadas como lista blanca de inventario,
  no solo como prioridad. Una reserva nunca puede caer en una sede fuera del alcance
  del operador. Las rutas públicas del cliente conservan su autorización firmada y
  no usan el RBAC administrativo.

## Pagos

- La configuración de pagos falla cerrada: solo `active === true` habilita cobros.
- Checkout Wompi y PayU exigen acceso firmado vinculado con la orden y la sesión.
- Los webhooks validan configuración, firma, comercio, moneda, importe y transición.
- Cada formulario emitido crea o reutiliza un `PaymentAttempt` persistente. La
  referencia, proveedor, importe, moneda y fotografía del saldo aplicado son la
  autoridad del webhook; nunca se reconstruyen desde el estado mutable de la orden.
- Solo puede existir un intento activo por orden, incluso si el comprador cambia de
  Wompi a PayU. Un intento sustituido, desconocido o incompatible pasa a conciliación
  y no puede liberar ni consumir los recursos del intento vigente.
- Un pago aprobado después de liberar saldo, cambiar el importe o completar la orden
  requiere revisión humana. La aplicación conserva la evidencia y evita acreditar o
  cobrar dos veces.
- Las respuestas públicas no exponen credenciales ni permiten enumerar órdenes.
- Las rutas administrativas sensibles requieren permiso granular y auditoría.

## Efectos posteriores al pago

Inventario, facturación y notificaciones no se consideran una única llamada remota.
Después del commit cada efecto conserva su propio estado, identificador de claim y
marca de finalización. Un proceso vencido no puede finalizar el claim de otro worker,
y repetir una tarea terminada no vuelve a emitir el documento ni la entrega.

`Order.paymentProcessing` funciona como outbox transaccional embebido. Cada réplica
escanea lotes de pendientes, fallidos y leases vencidos, mientras MongoDB coordina
la exclusión mediante claims atómicos ligados a proveedor y transacción. El worker
no mantiene autoridad financiera propia: únicamente redirige el orquestador común.
El correo de entrega tiene un fencing token adicional para impedir que un worker
vencido sobrescriba el resultado del nuevo propietario.

## Integridad de reembolsos

- El reembolso exige evidencia `payment.status === paid`; el estado logístico no
  sustituye la confirmación del dinero.
- El importe debe coincidir con las líneas históricas después de descuentos e
  impuestos, y la nota crédito oficial debe coincidir con ese mismo importe.
- El endpoint financiero nunca repone inventario: la reposición pertenece al RMA
  inspeccionado que la autoriza explícitamente.
- Hasta implementar distribución automática por fuente, una compra pagada total o
  parcialmente con saldo a favor se envía a revisión manual. Es preferible detenerla
  con evidencia completa que devolver pasarela y saldo dos veces.
- Los procesos automáticos usan fencing tokens; un worker cuyo claim venció no puede
  cerrar el claim renovado por otro worker.

## Consultas y crecimiento

- El listado administrativo pagina y agrega métricas en MongoDB, con orden estable e
  índices por sede, estado y fecha.
- Timeline y notas se consultan por páginas/cursor y tienen índices compuestos.
- Selecciones, etiquetas y exportaciones aceptan como máximo 500 órdenes por solicitud.
- La transición masiva de estado tiene además un máximo más estricto de 100 órdenes;
  etiquetas y exportaciones seleccionadas conservan el máximo de 500.
- El esquema `Order` conserva un presupuesto preventivo de índices. Un índice simple
  que ya sea prefijo de uno compuesto no puede volver a declararse.
- Los servicios de transportadora dependen de adaptadores; el dominio no contiene
  llamadas reales codificadas a un proveedor.

El timeline tiene dos niveles deliberados: `Order.timeline` conserva un resumen
embebido de las 200 entradas más recientes para la vista rápida, mientras
`OrderEvent` es el historial canónico paginado y no se trunca. Las escrituras que
afectan ambos se realizan en la misma transacción.

Para despliegues con varias réplicas todavía se requiere infraestructura compartida
para límites de frecuencia. El outbox post-pago no requiere afinidad de proceso: su
estado e índices viven en MongoDB y los claims coordinan las réplicas. Una cola
externa puede sustituir el polling si el volumen futuro lo exige sin cambiar el
contrato del dominio.

## Condiciones de despliegue

El código debe fallar al arrancar si falta una ruta o servicio crítico de Órdenes;
solo integraciones verdaderamente opcionales pueden omitirse. Antes de producción se
debe comprobar además:

1. MongoDB en replica set, con transacciones y creación de índices completada.
2. Secretos, comercios y URLs públicas permanentes de Wompi, PayU, facturación y
   transportadora; nunca túneles temporales.
3. Historial de claves suficiente para verificar intentos emitidos antes de una
   rotación de credenciales.
4. Rate limit compartido; worker post-pago habilitado; métricas, alertas y trazas por
   orden, intento de pago, reembolso y claim.
5. Ensayo transaccional, recorrido E2E y reconciliación con los proveedores en un
   entorno staging equivalente a producción.

Las migraciones de índices se inspeccionan primero en modo `dry-run`. Antes del
despliegue se deben revisar y después aplicar explícitamente los comandos de:

- actividad y timeline: `migrate:order-activity-indexes`;
- cursor administrativo: `migrate:order-admin-cursor-index`;
- devoluciones: `migrate:order-return-indexes`;
- reembolsos: `migrate:order-refund-indexes`;
- idempotencia de creación: `migrate:idempotency-key-indexes`;
- operaciones de envío: `migrate:shipping-operation-indexes`;
- intentos de pago: `migrate:payment-attempt-indexes`;
- evidencia de pago manual: `migrate:manual-payment-indexes`.
- outbox post-pago: `migrate:order-postcommit-indexes`.

La revisión conjunta se ejecuta con
`npm --prefix backend run migrate:orders:indexes:dry-run`. El comando no acepta
banderas de escritura y falla si alguna migración no demuestra modo `dry-run` o
`plan`, cero mutaciones y ausencia de operaciones destructivas.

En un entorno local o de pruebas, la aplicación conjunta requiere
`npm --prefix backend run migrate:orders:indexes:apply:test -- --confirm-test-order-index-application`.
Este comando repite primero el `dry-run`, se bloquea si `NODE_ENV=production` y
detiene la secuencia ante el primer error sin eliminar datos ni índices.

Ninguna migración usa `syncIndexes`, elimina ni renombra índices automáticamente.
En producción exige la bandera de aplicación de su comando y la confirmación
adicional documentada por el propio script. Un índice incompatible detiene el
preflight para que el rollback sea una decisión operativa explícita.

## Regla de evolución

`testOrderModuleBoundaries.js` impide que las fachadas vuelvan a crecer, limita los
módulos internos, detecta ciclos en el subgrafo de Órdenes, exige modelos canónicos y
protege la composición del endpoint de creación. La prueba complementaria
`testBackendCommonJsAcyclicity.js` recorre controladores, rutas, servicios y modelos
del backend completo, además de verificar varios órdenes de carga fiscal. Cuando un
archivo llegue a su límite, debe separarse por una responsabilidad real; no se eleva
el límite para ocultar crecimiento.

Una refactorización del módulo debe conservar los contratos públicos y pasar las
pruebas de seguridad, arquitectura, transacciones, pagos, inventario, logística,
devoluciones, frontend y compilación antes de integrarse.
