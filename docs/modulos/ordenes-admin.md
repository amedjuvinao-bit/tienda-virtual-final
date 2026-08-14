# Módulo administrativo de Órdenes

## Estado del trabajo

- Rama de evolución: `feature/ordenes-admin-avanzado`.
- Etapa actual: **5. Centro operativo comercial y logístico**.
- Estado de la etapa: implementada y cubierta por pruebas automáticas.
- Siguientes etapas: observabilidad/stress y cierre integral.

Este documento registra las decisiones verificables del módulo. La etapa 1 estableció la frontera de confianza. La etapa 2 conecta devolución, inventario, dinero, caja y documento fiscal sin afirmar éxitos que todavía dependan de una acción externa. La etapa 3 separa la lectura administrativa del archivo principal y elimina cargas repetidas que no escalan con el volumen de órdenes. La etapa 4 incorpora preparación y entrega física trazable por sede sin duplicar movimientos de inventario ni simular integraciones de transportadora. La etapa 5 transforma el listado en una mesa operativa que prioriza acciones reales con la misma autoridad logística.

## Centro operativo comercial y logístico

El listado ya no depende de vistas rápidas flotantes ni de tarjetas sobredimensionadas. Las ocho colas se integran como una barra compacta de flujo: atención inmediata, pagos pendientes, preparación, despacho, tránsito, incidencias, SLA en riesgo y completadas. En pantallas pequeñas la barra se convierte en un selector único para no ocupar varias filas. Los contadores respetan sesión, sede, búsqueda, fechas, estado, etiquetas, archivo y filtro de factura.

`operationalView` es un valor cerrado validado en backend. MongoDB aplica el filtro antes de paginar y calcula los contadores mediante `$facet`; React no recibe el universo de órdenes para volver a clasificarlo. Una orden aparece en preparación solo si tiene pago confirmado y asignaciones físicas vendidas vigentes o un envío ya iniciado. Los productos digitales y servicios sin inventario no se presentan falsamente como trabajo de bodega.

Cada fila recibe un resumen derivado por el servidor:

- cola, urgencia y siguiente acción;
- cantidad de envíos e incidencias abiertas;
- progreso logístico consolidado;
- próximo vencimiento y estado SLA (`on_track`, `risk` o `breached`);
- sede o distribución multisede, canal, unidades, valor y estado comercial.

La prioridad se resuelve en este orden: pago fallido, incidencia abierta, SLA vencido, SLA en riesgo, pago pendiente y flujo logístico. Así una alerta crítica no queda oculta por un estado comercial general. En escritorio la bandeja usa una tabla semántica de ancho porcentual, sin mínimos que corten la última columna; en resoluciones menores cada fila se reorganiza como una ficha de dos columnas. `Gestionar` permanece visible en ambos modos. La bandeja conserva lectura cómoda o compacta y las mutaciones siguen protegidas por los permisos de las etapas anteriores.

## Logística avanzada multisede

### Envíos como unidad operativa

Una orden física puede originar varios envíos. `backend/services/orderLogisticsService.js` agrupa las asignaciones vendidas por sede y crea un envío independiente con:

- asignaciones exactas de inventario y cantidad a preparar;
- picking, packing, despacho, tránsito y entrega;
- prioridad, paquetes, peso y referencias de etiqueta;
- transportadora, nivel de servicio, guía y URL de seguimiento;
- compromisos SLA para picking, despacho y entrega;
- manifiesto de despacho y evidencia final de entrega;
- incidencias tipificadas, severidad, resolución y actor;
- historial acotado y revisión optimista para evitar sobrescrituras concurrentes.

El flujo permitido es `ready_to_pick → picking → picked → packing → packed → dispatched → in_transit → delivered`. Una incidencia mueve el envío a `exception`, conserva el punto de reanudación y exige una resolución antes de continuar.

Las órdenes anteriores a esta etapa se reconstruyen desde `shippedQuantity` y `deliveredQuantity`: un envío histórico ya despachado o entregado no retrocede a picking. Queda marcado con `initializationSource: legacy_allocation_state` y una nota explícita indica que la referencia externa anterior no estaba disponible.

### Coherencia con inventario, productos y sedes

Los envíos se construyen únicamente desde `inventoryAllocations` confirmadas y con cantidad vendida vigente. Un despacho llama a `advanceOrderInventoryAllocationsForShipment` y marca como enviadas solo las asignaciones incluidas en ese envío; una entrega hace lo mismo para la cantidad entregada. No se modifica `InventoryStock`, porque la venta ya consumió la reserva en su transacción autoritativa.

Un operador de sede solo inicializa y modifica envíos de sus sedes asignadas, incluso cuando la orden contiene mercancía de otras sedes. `owner` y `admin` conservan alcance global. El índice `orders_logistics_branch_status_sla` permite localizar trabajo por sede, estado y vencimiento.

### Coherencia comercial

- Caja y pagos no se modifican durante picking, packing o despacho.
- La factura y sus documentos DIAN permanecen como snapshots comerciales independientes.
- La orden solo pasa a `shipped` cuando todos sus envíos activos fueron despachados.
- La orden solo pasa a `delivered` cuando todos los envíos tienen evidencia de entrega y no quedan entregas digitales o servicios pendientes.
- Los cambios globales de estado responden `ORDER_LOGISTICS_DISPATCH_REQUIRED` u `ORDER_LOGISTICS_DELIVERY_REQUIRED` si intentan saltarse el flujo.
- Una devolución posterior continúa usando el contrato de conciliación de inventario, dinero, caja y nota crédito de la etapa 2.

No se afirma que una guía exista en un proveedor externo: nombre, guía, URL, manifiesto y prueba de entrega son referencias operativas ingresadas y auditadas. Una futura integración deberá validar esas referencias con credenciales propias de cada transportadora.

### API y concurrencia

| Endpoint | Propósito | Permiso |
|---|---|---|
| `GET /api/orders/:id/fulfillment/logistics` | Consultar resumen y envíos | `orders:view` |
| `POST /api/orders/:id/fulfillment/logistics/initialize` | Crear/sincronizar envíos autorizados por sede | `orders:fulfillment` |
| `PATCH /api/orders/:id/fulfillment/logistics/shipments/:shipmentId` | Plan, transición, incidencia o resolución | `orders:fulfillment` |

Cada mutación exige `expectedRevision`. Si otro operador guardó antes, responde `LOGISTICS_REVISION_CONFLICT`; la interfaz recarga el envío en vez de sobrescribir el cambio.

### Centro logístico en el detalle

`OrderDetailLogisticsPanel.jsx` presenta indicadores de envíos, despachos, entregas, incidencias y SLA vencidos. Cada sede tiene progreso visual, compromisos, plan de transportadora/paquetes, acción contextual y gestión de incidentes. Un perfil de solo lectura ve toda la trazabilidad con controles deshabilitados; el permiso `orders:fulfillment` habilita las operaciones.

## Arquitectura y rendimiento

### Separación de responsabilidades

`GET /api/orders/admin` conserva su URL, autorización, filtros y forma de respuesta, pero ya no implementa la consulta dentro de `backend/routes/orders.js`.

- `backend/controllers/orderAdminQueryController.js` traduce el resultado a HTTP y CSV.
- `backend/services/orderAdminQueryService.js` valida filtros, construye pipelines, pagina, calcula indicadores y deriva los productos.
- `frontend/src/admin/orders/hooks/useOrdersAdminQuery.js` administra carga, errores, concurrencia y conservación de métricas.
- `frontend/src/admin/OrdersAdmin.jsx` queda concentrado en composición y operaciones de interfaz.

El archivo principal de rutas pasó de 3.350 a 2.734 líneas. Las rutas públicas de creación y pago y las mutaciones administrativas mantienen sus contratos actuales; esta separación no cambia las integraciones con inventario, caja, productos ni facturación.

### Consulta escalable

La implementación anterior recorría varias veces el mismo conjunto y llevaba a Node.js todos los identificadores de órdenes para volver a consultar facturas. El motor nuevo:

- ejecuta la página y el resumen como pipelines explícitos de MongoDB;
- relaciona facturas por `$lookup` sobre `ElectronicInvoice.orderId`, que ya está indexado;
- calcula en una sola agregación total, ventas, pendientes, canceladas, ticket promedio, órdenes sin factura y validadas DIAN;
- usa `allowDiskUse(true)` para evitar depender del límite de memoria de una agregación grande;
- pagina con un desempate estable por `_id`, evitando repetir u omitir filas con la misma fecha o total;
- aplica la búsqueda por sede tanto a la sede principal como a las asignaciones de inventario multisede;
- mantiene la población de productos limitada únicamente a los ítems de la página visible.

Los índices compuestos `orders_admin_branch_status_date`, `orders_admin_allocation_status_date` y `orders_admin_archive_status_date` cubren las combinaciones operativas más frecuentes de sede, estado, archivo y fecha.

### Métricas independientes de la paginación

El parámetro `includeSummary` es opcional y compatible hacia atrás:

- omitido o `1`: entrega `total`, `totalPages` y `financialSummary`;
- `0`: entrega solo la página solicitada y marca `summaryIncluded: false`.

La interfaz solicita el resumen al entrar o cambiar un filtro comercial. Cambiar únicamente página, tamaño, orden o población de productos reutiliza el total conocido y no recalcula todos los indicadores. Cambiar el tamaño de página recalcula localmente el número de páginas a partir del total ya autorizado.

### Concurrencia en React

El hook del listado mantiene un registro de solicitudes en curso por parámetros. El doble efecto de `StrictMode` reutiliza la misma promesa en vez de generar dos lecturas idénticas. Un contador de secuencia impide que una respuesta antigua sobrescriba resultados obtenidos con filtros más recientes.

Los filtros de estado y etiquetas son autoritativos en backend. La interfaz ya no vuelve a recortar una página después de recibirla, lo que evitaba inconsistencias entre cantidad visible, total y paginación.

## Conciliación comercial de devoluciones

Una devolución interna ya no equivale automáticamente a un reembolso comercial terminado. `OrderRefund` conserva cuatro etapas independientes:

| Etapa | Autoridad | Regla de cierre |
|---|---|---|
| Inventario | transacción MongoDB de `orderRefundService` | unidades devueltas, existencias y kardex confirmados |
| Dinero | comprobante de reverso o reintegro | referencia explícita confirmada por un usuario con `orders:refund` |
| Caja | `cashSessionService` | resumen de la sesión recalculado con la devolución vigente |
| Facturación | documento oficial Factus | nota crédito enviada/validada o constancia de que no aplica |

Los estados posibles por etapa son `not_required`, `pending`, `action_required`, `processing`, `completed` y `failed`. El resultado general solo es `completed` cuando las cuatro etapas están resueltas. Una orden cambia a `refunded` únicamente si, además, el valor acumulado reembolsado cubre el total de la orden.

### Reverso del dinero

El endpoint `POST /api/orders/:orderId/refunds/:refundId/confirm-payment` exige permiso `orders:refund`, alcance sobre la sede y una referencia verificable. Una repetición con la misma referencia es idempotente; una referencia diferente después del cierre produce conflicto.

No se simula un reembolso automático de Wompi. La integración existente conserva el identificador de transacción, pero la devolución monetaria permanece como `action_required` hasta que el operador confirma el comprobante real. Esto evita tratar un `void` limitado o un procedimiento externo como si fuera un reembolso parcial universal.

### Caja y pagos mixtos

La sesión POS ahora calcula:

- órdenes canceladas y órdenes con devolución;
- valor bruto, devoluciones registradas y venta neta;
- pagos netos después de reintegros confirmados;
- reparto proporcional y acotado de una devolución sobre pagos mixtos.

Una devolución registrada reduce la venta neta, pero no reduce el efectivo esperado ni los pagos cobrados hasta confirmar la salida real del dinero. Ningún método puede terminar con saldo negativo.

### Nota crédito

Cuando existe una factura Factus validada, la conciliación fiscal queda en `action_required`. `POST /api/payments/admin/create-credit-note/:orderId` puede recibir `refundId`; después de crear o reutilizar idempotentemente la nota oficial, la vincula con esa devolución.

Si Factus ya creó el documento y falla únicamente el enlace local, la respuesta conserva `success: true`, usa HTTP 202 y entrega `reconciliationWarning`. Reintentar con la misma clave recupera el vínculo sin duplicar el documento fiscal.

### Interfaz administrativa

El detalle de la orden consulta `GET /api/orders/:orderId/refunds` y presenta un panel con las cuatro etapas. Un usuario con `orders:refund` puede registrar la referencia del reintegro; un perfil de solo lectura ve la trazabilidad, pero no puede confirmar dinero devuelto.

## Fronteras de confianza

### Sesión administrativa

El frontend consume exclusivamente la sesión validada por `AuthContext`. `OrdersAdmin` no lee tokens directamente de `localStorage` ni instala credenciales alternativas.

La autenticación heredada por `ADMIN_USER` y `ADMIN_PASSWORD_HASH` está deshabilitada por defecto. Solo puede habilitarse temporalmente con:

```env
ALLOW_LEGACY_ADMIN_AUTH=true
```

Aun habilitada, una sesión heredada no omite permisos granulares salvo que una ruta de migración lo autorice de forma explícita con `allowLegacyAdmin: true`. Ninguna operación del módulo de Órdenes usa esa excepción.

### Aislamiento por sede

La autoridad está centralizada en `backend/services/orderAdminScopeService.js`.

- `owner` y `admin`, los dos roles privilegiados definidos por el sistema, pueden operar todas las sedes.
- Los demás roles solo alcanzan su sede predeterminada y sus sedes asignadas.
- Una orden multisede pertenece al alcance cuando su sede principal o alguna asignación de inventario corresponde a una sede autorizada.
- Un usuario operativo sin sede asignada falla de forma cerrada con `NO_BRANCH_ASSIGNED`.
- Solicitar explícitamente una sede ajena responde `BRANCH_FORBIDDEN`.
- Una selección masiva que mezcle órdenes autorizadas y no autorizadas se rechaza completa con `ORDER_SELECTION_OUT_OF_SCOPE`.

El mismo alcance protege listado, detalle, estado, cumplimiento, impresión, archivo, datos de cliente, etiquetas, notas, historial, correo, PDF, XML, reembolso, exportación seleccionada y acciones masivas. También se verifica antes de generar/reintentar facturas o crear notas crédito desde una orden.

## Matriz RBAC

| Operación | Permiso |
|---|---|
| Listar y ver detalle, historial y notas | `orders:view` |
| Exportar resultados o selección | `orders:export` |
| Ejecutar estado/tags masivos | `orders:bulk` |
| Cambiar estado | `orders:status` |
| Gestionar picking, packing, envíos y prestaciones | `orders:fulfillment` |
| Marcar como impresa | `orders:mark_printed` |
| Archivar o desarchivar | `orders:archive` |
| Editar datos de cliente/facturación | `orders:customer_data` |
| Editar etiquetas | `orders:tags` |
| Crear, editar o eliminar notas | `orders:notes` |
| Enviar correo | `orders:email` |
| Descargar PDF/XML | `billing:download` |
| Procesar devolución | `orders:refund` |
| Crear/reintentar documentos electrónicos | permisos específicos `billing:*` |

La regla `DELETE /api/orders/:id` fue retirada del mapa porque no existe un endpoint de eliminación de órdenes. Esto evita declarar una capacidad destructiva ficticia.

## Contratos de datos

### Actores auditables

Los eventos administrativos toman el actor de la sesión validada (`adminUsername` o `adminUserId`). El encabezado manipulable `x-admin-user` no es autoridad para Órdenes, correos ni operaciones de facturación relacionadas.

### Cliente y facturación

`PATCH /api/orders/:id/customer-data` acepta únicamente campos incluidos en listas explícitas de cliente y facturación. Descarta objetos, arreglos y claves no autorizadas, limita textos y registra en el historial solo los nombres de campos modificados; no duplica valores personales completos dentro del evento de auditoría.

### Notas y etiquetas

- Notas: texto obligatorio, limpio y limitado a 2.000 caracteres.
- Edición de nota: rechaza parches vacíos o textos vacíos.
- Etiquetas: normalizadas, únicas, máximo 20 y 24 caracteres por etiqueta.
- El autor de una nota se deriva de la sesión y no del cuerpo HTTP.

### Correos

Existe una sola ruta autoritativa: `backend/routes/orderEmailRoutes.js`. Los cuatro tipos admitidos son:

- `confirmation`
- `invoice`
- `status`
- `payment`

La plantilla escapa contenido dinámico antes de generar HTML y la interfaz presenta exactamente esas cuatro acciones.

## Permisos en la interfaz

Un usuario con `orders:view` puede consultar listado, detalle, historial, inventario asignado y notas existentes. Cada control de mutación se renderiza solo cuando existe su permiso correspondiente:

- exportación y selección;
- estado y etiquetas;
- impresión y archivo;
- creación de notas;
- envío de correo;
- logística física y edición de prestaciones;
- descarga de documentos electrónicos.

Las funciones también verifican sesión y permiso antes de ejecutar la solicitud, de modo que ocultar botones no es la única barrera.

## Verificación desde consola

Desde la raíz del repositorio en Windows:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-security
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-architecture
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-logistics
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-operations
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-refund-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-commercial-reconciliation
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-bulk-status-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-multi-branch-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:complete-sale-contract
cd /d C:\MisProyectosReact\tienda-virtual-final\frontend && npm run test:orders-security && npm run test:orders-architecture && npm run test:orders-logistics && npm run test:orders-operations && npm exec -- vitest run && npm run build
```

Las integraciones transaccionales que usan MongoDB se ejecutan por separado cuando existe `PRODUCTS_TEST_MONGO_URI` o `MONGODB_REPLICA_URI`; no deben apuntar a datos productivos.

## Evidencia de la etapa 1

- Seguridad backend: 10 controles, incluyendo respuestas HTTP 401/403, RBAC, sede, actores y contratos.
- Seguridad frontend: 7 pruebas de sesión, solo lectura, capacidades y controles de detalle.
- Regresión frontend completa: 23 archivos y 88 pruebas.
- Build de producción: aprobado con Vite.
- Contratos vecinos verificados: estados masivos, multisede, venta completa, facturación, favoritos y carritos.

## Evidencia de la etapa 2

- Conciliación comercial: 10 controles de modelo, estados, caja, pagos mixtos, permisos y vínculo fiscal.
- Interfaz de conciliación: prueba de visibilidad de las cuatro etapas y bloqueo sin referencia.
- El contrato se ejecuta en GitHub Actions dentro de `products-ci.yml`.
- Las pruebas no llaman gateways ni escriben en bases de datos productivas.

## Evidencia de la etapa 3

- Arquitectura backend: 10 controles sobre separación, filtros, paginación, agregaciones, colas, índices y compatibilidad de respuesta.
- Concurrencia frontend: 3 pruebas sobre doble montaje, respuestas obsoletas y paginación sin recalcular métricas.
- Seguridad de Órdenes: 10 controles backend y 7 pruebas frontend conservados.
- El contrato nuevo se ejecuta en GitHub Actions dentro de `products-ci.yml`.
- Las pruebas de arquitectura usan modelos simulados y no escriben en MongoDB.

## Evidencia de la etapa 4

- Logística backend: 14 controles sobre modelo, compatibilidad histórica, RBAC, sedes, estados, SLA, evidencia, incidencias, concurrencia e inventario selectivo.
- Centro logístico: 4 pruebas de inicialización autorizada, orden operativo, solo lectura y resolución de incidencias.
- Seguridad: el permiso `orders:fulfillment` separa logística de la edición general de una orden.
- CI ejecuta `test:orders-logistics` sin transportadoras externas ni escritura en bases productivas.

## Evidencia de la etapa 5

- Centro operativo backend: 13 controles sobre vistas cerradas, pago, inventario físico, SLA, incidencias, prioridades, agregación y CI.
- Centro operativo frontend: 5 pruebas sobre contadores, filtros, trazabilidad por fila, densidad, tabla semántica, acción responsive y estado vacío.
- Arquitectura: el resumen financiero conserva compatibilidad y añade `operationalSummary` solo cuando `includeSummary` está activo.
- Rendimiento: cambiar únicamente página continúa reutilizando métricas; cambiar de cola solicita una página y resumen coherentes.
- El contrato se ejecuta en GitHub Actions y no escribe en MongoDB ni llama servicios externos.
- El recorrido contractual verifica que una orden no se cierra antes del manifiesto y la prueba de entrega.

## Evidencia de la etapa 6

- La bandeja y la consola ocupan columnas independientes: al abrir filtros, métricas y tabla se compactan dentro del espacio disponible sin superposición ni pérdida funcional.
- El botón `Mostrar/Ocultar filtros` es horizontal, discreto y cristalizado; se monta directamente sobre `document.body` para que ningún contenedor del panel pueda recortarlo, permanece sobre el contenido con posición fija, se limita al área visible, puede arrastrarse y conserva localmente la posición elegida sin bloquear el clic accesible.
- La consola tiene altura natural y desplazamiento de página: filtros, nueve colas y siete estados DIAN se muestran completos, incluido el bloque de facturación electrónica, sin recortes ni scroll interno.
- El modo compacto de colas usa una matriz 3 × 3 y la facturación electrónica conserva sus siete opciones en una matriz legible dentro de la consola.
- La tabla operativa original se conserva íntegra, con su distribución, densidad, selección, ordenamiento, prioridad, SLA y acción `Gestionar`; el botón flotante vive fuera de ella y no puede recortarla ni modificarla.
- Centro operativo frontend: 6 pruebas, incluida la apertura y cierre accesible de la consola desde el nivel principal.
- Regresión frontend completa: 28 archivos y 105 pruebas aprobadas; build de producción aprobado con Vite.

## Trabajo pendiente deliberado

1. Pruebas transaccionales/stress con réplica MongoDB, métricas operativas y alertas.
2. Cierre integral, documentación final y fusión controlada de la rama.
