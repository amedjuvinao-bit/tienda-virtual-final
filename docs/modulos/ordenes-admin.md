# Módulo administrativo de Órdenes

## Estado del trabajo

- Rama de evolución: `feature/ordenes-admin-avanzado`.
- Etapa actual: **Evolución Plus · Fase 2: reembolsos automáticos y transportadoras**.
- Estado de la etapa: reembolsos automáticos implementados; Envia Sandbox validado con cotización, guía, etiqueta y seguimiento; Producción permanece bloqueada hasta comprobar el webhook sobre una URL HTTPS permanente.
- Siguiente validación externa: desplegar el backend en una dirección HTTPS permanente, configurar las credenciales reales desde el panel y recibir una prueba auténtica del webhook de Envia Producción antes de activar operaciones con costo.

Este documento registra las decisiones verificables del módulo. La etapa 1 estableció la frontera de confianza. La etapa 2 conecta devolución, inventario, dinero, caja y documento fiscal sin afirmar éxitos que todavía dependan de una acción externa. La etapa 3 separa la lectura administrativa del archivo principal y elimina cargas repetidas que no escalan con el volumen de órdenes. La etapa 4 incorpora preparación y entrega física trazable por sede sin duplicar movimientos de inventario ni simular integraciones de transportadora. La etapa 5 transforma el listado en una mesa operativa que prioriza acciones reales con la misma autoridad logística. La etapa 6 consolida la consola visual sin alterar la tabla original. La etapa 7 añade diagnóstico agregado, alertas y una prueba profesional de transacciones y concurrencia sobre una base temporal aislada. La etapa 8 permite convertir cada hito confirmado en un informe seguro para el cliente, con vista previa y apertura asistida de WhatsApp. La etapa 9 separa el expediente físico RMA del movimiento monetario y evita reponer unidades no inspeccionadas.

## Posventa avanzada RMA

`OrderReturn` es la autoridad del recorrido físico. Una solicitud reserva las unidades elegibles para impedir expedientes o reembolsos superpuestos y conserva una revisión optimista. La política predeterminada es de 30 días desde la entrega; puede ajustarse con `ORDER_RETURN_WINDOW_DAYS`. Una excepción vencida exige justificación auditable.

El recorrido es `requested → authorized → in_transit → received → resolution_required → resolved`. El tránsito es opcional y una solicitud también puede quedar `rejected` o `cancelled` antes de la recepción. Cada mutación exige `expectedRevision`; un cambio concurrente responde `RETURN_REVISION_CONFLICT` en lugar de sobrescribir a otro operador.

Durante la inspección, cada unidad recibida debe clasificarse exactamente una vez:

- `sellableQuantity`: vuelve a existencias y genera kardex `return_in` con fuente `OrderReturn`;
- `damagedQuantity`: se acepta comercialmente, pero no vuelve al stock disponible;
- `quarantineQuantity`: queda aceptada y aislada para decisión posterior;
- `rejectedQuantity`: no genera reembolso ni reposición.

El reembolso se crea únicamente después de cerrar la inspección y usa `restockQuantity: 0`, porque el inventario ya fue tratado por el RMA. El endpoint histórico de reembolso permite ajustes exclusivamente financieros, pero responde `RETURN_INSPECTION_REQUIRED` si intenta reponer inventario físico. Un cambio solo se cierra cuando enlaza una orden de reemplazo real, diferente, vigente y visible dentro del alcance por sede.

| Endpoint | Propósito | Permiso |
|---|---|---|
| `GET /api/orders/:id/returns` | Consultar política, elegibilidad y expedientes | `orders:view` |
| `POST /api/orders/:id/returns` | Crear solicitud de devolución o cambio | `orders:returns` |
| `PATCH /api/orders/:id/returns/:returnId` | Autorizar, rechazar, recibir, inspeccionar o cancelar | `orders:returns` |
| `POST /api/orders/:id/returns/:returnId/refund` | Resolver con reembolso posterior a inspección | `orders:refund` |
| `POST /api/orders/:id/returns/:returnId/exchange` | Resolver enlazando orden de reemplazo | `orders:returns` |

El encargado de sede y bodega reciben `orders:returns`; bodega no recibe `orders:refund`. El perfil de facturación conserva `orders:refund` y no obtiene autoridad sobre la pieza física. `owner` y `admin` mantienen ambos permisos. La pestaña `Posventa` refleja esa separación: lectura completa para `orders:view`, operación física para `orders:returns` y botón monetario solo para `orders:refund`.

## Comunicación asistida de la trazabilidad

La opción A no usa credenciales de Meta ni afirma que el mensaje fue entregado. Después de confirmar una etapa comercial o logística, el detalle presenta una acción inmediata `Informar por WhatsApp`. La misma acción permanece disponible dentro de `Gestionar orden` para preparar nuevamente el estado más reciente.

El backend selecciona el último evento apto para el cliente y construye un informe con:

- número de orden y fecha de actualización;
- qué pasó, estado actual y siguiente paso;
- sede, transportadora, guía, enlace seguro y promesa de entrega cuando correspondan;
- nombre comercial configurado en `SiteSettings.store`.

Notas, etiquetas, actores, severidades y descripciones internas de incidencias no se incorporan al mensaje. El teléfono se toma de la orden, se normaliza a formato internacional y se devuelve enmascarado para la interfaz y la auditoría. Un celular colombiano de diez dígitos recibe el prefijo `57`.

| Endpoint | Propósito | Permiso |
|---|---|---|
| `GET /api/orders/:id/customer-notifications/whatsapp/preview` | Generar la vista previa desde la última etapa notificable | `orders:email` |
| `POST /api/orders/:id/customer-notifications/whatsapp/opened` | Registrar que el administrador abrió el chat preparado | `orders:email` |

El enlace `wa.me` se abre exclusivamente después de la decisión del administrador. El registro `whatsapp_opened` significa “preparado/abierto”; nunca equivale a enviado, entregado o leído. `OrderCustomerNotification` conserva una huella idempotente, contador de aperturas, etapa, destino enmascarado y actor, pero no almacena el teléfono completo ni secretos de WhatsApp.

## Observabilidad y stress transaccional

`GET /api/orders/admin/operations/health` entrega un diagnóstico privado y no cacheable, protegido por `orders:view` y limitado a las sedes autorizadas del usuario. No devuelve órdenes, clientes ni referencias individuales: expone únicamente cantidades agregadas, latencia de la consulta, estado general y alertas independientes.

El diagnóstico calcula en una sola agregación con `$facet`:

- fallos de pago ocurridos durante las últimas 24 horas;
- órdenes pagadas con inventario vendido que llevan más de dos horas sin preparación;
- incidencias abiertas y su nivel alto o crítico;
- compromisos SLA vencidos o que vencen dentro de 24 horas;
- envíos en despacho o tránsito sin actualización durante más de 48 horas;
- latencia de la propia consulta operativa;
- las nueve colas del centro de operaciones dentro del mismo alcance por sede.

Cada señal produce un check `ok`, `warning` o `critical`. El estado global es `healthy`, `degraded` o `critical` según la alerta de mayor severidad. El diagnóstico no consulta Wompi, Factus, correo, transportadoras ni otros servicios externos, y tampoco sincroniza o modifica índices.

`testOrderTransactionalStress.js` usa exclusivamente `ORDERS_STRESS_MONGO_URI`, exige host local, nombre de base `orders_ci_stress` y `replicaSet`. La prueba crea 350 órdenes distribuidas entre pago pendiente, pago fallido, preparación atrasada, picking en riesgo, tránsito sin actualización, incidencia crítica y entrega completa. Después ejecuta 140 consultas con concurrencia 14 y valida:

- rollback completo cuando la persistencia del evento falla después de guardar la orden;
- inicialización logística idempotente bajo diez solicitudes simultáneas;
- revisión optimista con un único ganador y nueve conflictos controlados;
- recorrido transaccional desde preparación hasta entrega;
- coherencia entre envío, estado comercial y cantidades vendidas, despachadas y entregadas;
- p50, p95, latencia máxima, duración total y variación de memoria;
- detección de una corrupción controlada y restauración con cero inconsistencias finales;
- eliminación obligatoria de la base temporal al terminar, incluso si la prueba falla.

El stress no inicia servidor HTTP, no llama gateways, DIAN, correos o transportadoras y no acepta una URI `mongodb+srv` ni un nombre de base distinto al temporal autorizado.

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

Una guía ingresada manualmente continúa siendo una referencia operativa auditada y no se presenta como validada por un proveedor. Solo las guías creadas por el adaptador configurado guardan proveedor, modo, identificador externo, tarifa, etiqueta y seguimiento como evidencia de integración.

### Capa de transportadoras y Envia

`SHIPPING_PROVIDER=manual` conserva el comportamiento existente y evita conexiones externas por defecto. En producción, la autoridad pasa a **Configuración → Envíos → Transportadoras e integración API**: un administrador con `settings:shipping` elige el ambiente, guarda el token y el secreto de firma, prueba la autenticación, registra el webhook y activa el proveedor. Las variables `ENVIA_TOKEN`, `ENVIA_MODE` y `ENVIA_WEBHOOK_SECRET` quedan como compatibilidad para despliegues que todavía no han sido administrados desde el panel.

El despliegue debe definir una sola vez `INTEGRATIONS_ENCRYPTION_KEY` con al menos 32 caracteres. Esa llave nunca se administra desde el navegador: cifra con AES-256-GCM las credenciales guardadas en MongoDB y debe conservarse estable entre reinicios. El panel solo recibe campos de contraseña de escritura única, banderas e indicios finales; las respuestas API eliminan el token, el secreto y el material cifrado.

Guardar un token nuevo, cambiar de ambiente o reemplazar el secreto desactiva Envia y restablece sus verificaciones. Sandbox exige token, credencial Bearer exclusiva del webhook y una prueba auténtica recibida desde Envia. Producción añade confirmación explícita, `BACKEND_URL` HTTPS permanente, secreto HMAC y una prueba auténtica recibida desde Envia para la misma URL y ambiente. Los dominios temporales `trycloudflare.com` se rechazan en Producción. Si falta cualquier requisito, la operación manual continúa activa y las operaciones externas quedan bloqueadas.

El botón `Ya registré la URL` solo guarda que el administrador completó el registro en el portal. No aprueba la conexión. El panel consulta el estado cada tres segundos mientras espera y muestra `Webhook comprobado por Envia` únicamente después de que el backend recibe y valida el evento real. La evidencia conserva fecha, identificador, ambiente y URL; cambiar cualquiera de esos datos invalida la aprobación anterior.

La capa separa construcción del envío, adaptador del proveedor y orquestación de la orden. Antes de cotizar valida teléfono y dirección de sede y cliente, ciudad, departamento, peso y las tres dimensiones de cada paquete. Para Colombia normaliza el departamento al código de Envia y resuelve la ciudad con `POST /locate`; la cotización y la guía reciben el DANE de 8 dígitos exigido por el proveedor, no el nombre visible. Las credenciales permanecen en el backend y el endpoint de estado expone solo banderas seguras.

La generación y cancelación de guías usan `ShippingOperation` con clave idempotente y huella de la solicitud. La llamada externa ocurre fuera de una transacción MongoDB; si el proveedor confirma pero la persistencia local no termina, la operación queda `action_required` y el mismo intento no se repite silenciosamente. `ShippingWebhookEvent` deduplica el identificador firmado del proveedor y conserva el evento recibido para el procesamiento de estados posterior.

### API y concurrencia

| Endpoint | Propósito | Permiso |
|---|---|---|
| `GET /api/orders/:id/fulfillment/logistics` | Consultar resumen y envíos | `orders:view` |
| `POST /api/orders/:id/fulfillment/logistics/initialize` | Crear/sincronizar envíos autorizados por sede | `orders:fulfillment` |
| `PATCH /api/orders/:id/fulfillment/logistics/shipments/:shipmentId` | Plan, transición, incidencia o resolución | `orders:fulfillment` |
| `GET /api/orders/admin/shipping/providers` | Estado seguro de operación manual y proveedores | `orders:view` |
| `POST /api/orders/:id/fulfillment/logistics/shipments/:shipmentId/rates` | Cotizar con el proveedor configurado | `orders:fulfillment` |
| `POST /api/orders/:id/fulfillment/logistics/shipments/:shipmentId/label` | Generar guía y etiqueta con idempotencia | `orders:fulfillment` |
| `POST /api/orders/:id/fulfillment/logistics/shipments/:shipmentId/tracking/sync` | Sincronizar eventos de seguimiento | `orders:fulfillment` |
| `POST /api/orders/:id/fulfillment/logistics/shipments/:shipmentId/label/cancel` | Cancelar una guía con idempotencia | `orders:fulfillment` |
| `POST /api/shipping/webhooks/envia` | Recibir y deduplicar eventos con HMAC sobre el cuerpo crudo | Firma del proveedor |
| `GET /api/admin/shipping-settings` | Consultar estado y preparación sin revelar secretos | `settings:shipping` |
| `PUT /api/admin/shipping-settings` | Guardar ambiente y credenciales cifradas | `settings:shipping` |
| `POST /api/admin/shipping-settings/test` | Probar autenticación en el ambiente seleccionado | `settings:shipping` |
| `POST /api/admin/shipping-settings/webhook/confirm` | Anotar que la URL fue registrada y esperar la prueba real de Envia | `settings:shipping` |
| `POST /api/admin/shipping-settings/activate` | Activar Sandbox o Producción con sus precondiciones | `settings:shipping` |
| `POST /api/admin/shipping-settings/disable` | Volver a la operación manual | `settings:shipping` |

Cada mutación exige `expectedRevision`. Si otro operador guardó antes, responde `LOGISTICS_REVISION_CONFLICT`; la interfaz recarga el envío en vez de sobrescribir el cambio.

### Centro logístico en el detalle

`OrderDetailLogisticsPanel.jsx` presenta indicadores de envíos, despachos, entregas, incidencias y SLA vencidos. Cada sede tiene progreso visual, compromisos, plan de transportadora/paquetes, acción contextual y gestión de incidentes. La operación manual sigue disponible; Envia muestra su modo y queda bloqueado con explicación cuando falta el token. Con credenciales habilitadas aparecen cotización, selección de tarifa, generación/descarga de etiqueta, sincronización y cancelación. Un perfil de solo lectura ve la trazabilidad con controles deshabilitados; `orders:fulfillment` habilita las operaciones.

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
| Inventario | inspección RMA y transacción MongoDB | solo unidades aptas, existencias y kardex confirmados |
| Dinero | comprobante de reverso o reintegro | referencia explícita confirmada por un usuario con `orders:refund` |
| Caja | `cashSessionService` | resumen de la sesión recalculado con la devolución vigente |
| Facturación | documento oficial Factus | nota crédito enviada/validada o constancia de que no aplica |

Los estados posibles por etapa son `not_required`, `pending`, `action_required`, `processing`, `completed` y `failed`. El resultado general solo es `completed` cuando las cuatro etapas están resueltas. Una orden cambia a `refunded` únicamente si, además, el valor acumulado reembolsado cubre el total de la orden.

### Reverso del dinero

El endpoint `POST /api/orders/:orderId/refunds/:refundId/confirm-payment` exige permiso `orders:refund`, alcance sobre la sede y una referencia verificable. Una repetición con la misma referencia es idempotente; una referencia diferente después del cierre produce conflicto.

La Fase 2 incorpora automatización segura del cierre. Para una transacción Wompi con tarjeta, pago aprobado, ambiente coincidente y devolución total única, el administrador puede solicitar el `void` oficial. La operación toma primero un bloqueo persistente, consulta el estado remoto y reutiliza un `VOIDED` existente para evitar duplicados.

Los reembolsos parciales, pagos mixtos, efectivo, POS, PayU y cualquier medio sin una operación remota compatible permanecen en `action_required`. El panel explica la causa y conserva el campo para registrar el comprobante real; nunca presenta una devolución manual como automática.

### Caja y pagos mixtos

La sesión POS ahora calcula:

- órdenes canceladas y órdenes con devolución;
- valor bruto, devoluciones registradas y venta neta;
- pagos netos después de reintegros confirmados;
- reparto proporcional y acotado de una devolución sobre pagos mixtos.

Una devolución registrada reduce la venta neta, pero no reduce el efectivo esperado ni los pagos cobrados hasta confirmar la salida real del dinero. Ningún método puede terminar con saldo negativo.

### Nota crédito

Cuando existe una factura Factus validada, la conciliación fiscal queda en `action_required`. `POST /api/payments/admin/create-credit-note/:orderId` puede recibir `refundId`; después de crear o reutilizar idempotentemente la nota oficial, la vincula con esa devolución. La acción `POST /api/orders/:id/refunds/:refundId/automate` ejecuta el mismo contrato fiscal con una clave estable derivada del reembolso y exige simultáneamente `orders:refund` y `billing:credit_note`.

En el detalle administrativo, **Pago y factura > Devoluciones y conciliación > Automatizar cierre** intenta únicamente las etapas compatibles. Inventario, dinero, caja, nota crédito, intentos, referencias, estado del proveedor y fallos continúan guardados en la base principal para trazabilidad.

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
| Enviar correo o preparar informe asistido de WhatsApp | `orders:email` |
| Descargar PDF/XML | `billing:download` |
| Solicitar, autorizar, recibir e inspeccionar RMA; resolver cambios | `orders:returns` |
| Crear y conciliar reembolso monetario | `orders:refund` |
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

### WhatsApp asistido

El informe se genera en `orderCustomerNotificationService.js` y utiliza únicamente eventos permitidos: cambios comerciales, pago, preparación, picking, empaque, despacho, tránsito, entrega, incidencias redactadas de forma segura y actualización fiscal. Cambios de etiquetas, notas o planes internos no disparan el aviso.

La interfaz muestra una vista previa completa antes de abrir el chat. Si no existe un celular válido, el control queda deshabilitado y explica el dato faltante. El backend vuelve a validar teléfono, permiso y sede, por lo que la interfaz no es la autoridad del destinatario ni del contenido.

### Conexión entre órdenes y clientes

Las órdenes reales de checkout crean o reutilizan una ficha de `Customer` dentro de la misma transacción. La identidad se resuelve en orden determinista por `customerId`, documento, correo y celular; la orden conserva `customer.customerId`, `customerCode` y la forma en que se resolvió el vínculo. Las ventas POS rápidas también reutilizan una ficha existente antes de crear otra.

Las órdenes marcadas `DEMO` u `orders-trace` quedan deliberadamente fuera del CRM. Sus datos sí pueden corregirse dentro de la propia orden para validar WhatsApp, pero la opción `Esta orden y ficha del cliente` permanece bloqueada. Así, las pruebas visuales no crean clientes comerciales falsos.

Desde `Cliente e historial`, el permiso `orders:customer_data` habilita `Corregir datos` con dos alcances explícitos:

- `Solo esta orden`: modifica el snapshot usado por WhatsApp, entrega y facturación sin tocar la ficha maestra;
- `Esta orden y ficha del cliente`: además crea o actualiza el cliente vinculado, rechazando conflictos de correo, celular o documento.

Las estadísticas comerciales usan `customerRelationship.statsAppliedAt` como marca idempotente. Una compra confirmada se contabiliza una sola vez aunque el estado se reconcilie o se reintente.

Para órdenes reales antiguas existe una conciliación conservadora. Por defecto solo presenta un diagnóstico y nunca escribe:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run orders:customers-reconcile
```

Después de revisar el resumen, la aplicación explícita se ejecuta con:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run orders:customers-reconcile:apply
```

La conciliación no borra documentos, excluye órdenes DEMO y no procesa POS histórico para evitar duplicar estadísticas ya contabilizadas.

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
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-observability
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-whatsapp-assisted
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-customer-connection
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-billing-municipality
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-manual-invoice
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:billing-invoice-preflight
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-stress-plan
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-trace-seed
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-logistics-eligibility-trace
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-refund-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-commercial-reconciliation
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-bulk-status-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-multi-branch-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:complete-sale-contract
cd /d C:\MisProyectosReact\tienda-virtual-final\frontend && npm run test:orders-security && npm run test:orders-architecture && npm run test:orders-logistics && npm run test:shipping-settings-ui && npm run test:orders-operations && npm run test:orders-whatsapp-assisted && npm run test:orders-customer-connection && npm run test:orders-keyboard && npm run test:billing-invoice-preflight && npm exec -- vitest run && npm run build
```

Las pruebas automáticas de CI que usan MongoDB se ejecutan por separado con `PRODUCTS_TEST_MONGO_URI` o `MONGODB_REPLICA_URI` y no apuntan a datos productivos. Los recorridos persistentes documentados más adelante son una excepción manual: usan `MONGODB_URI`, exigen `--confirm-persist` y dejan evidencia DEMO identificable.

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
- El botón `Mostrar/Ocultar filtros` es horizontal, discreto y cristalizado; se monta directamente sobre `document.body` para que ningún contenedor del panel pueda recortarlo. Desanclado permanece fijo en la pantalla y puede arrastrarse; anclado conserva una coordenada del documento, bloquea el arrastre y puede liberarse nuevamente. Ambos modos persisten en el navegador y se ajustan horizontalmente al cambiar el ancho de la pantalla.
- La consola tiene altura natural y desplazamiento de página: filtros, nueve colas y siete estados DIAN se muestran completos, incluido el bloque de facturación electrónica, sin recortes ni scroll interno.
- El modo compacto de colas usa una matriz 3 × 3 y la facturación electrónica conserva sus siete opciones en una matriz legible dentro de la consola.
- Una búsqueda corta mantiene métricas, filtros activos y tabla en continuidad, sin espacios vacíos; la consola mantiene su altura natural en la columna lateral y en pantallas estrechas vuelve al flujo normal de una sola columna.
- Cada cola operativa expone su nombre y contador completos mediante una etiqueta de cristal al pasar el mouse o enfocarla con teclado; los estados DIAN conservan además una etiqueta nativa de respaldo.
- La tabla operativa original se conserva íntegra, con su distribución, densidad, selección, ordenamiento, prioridad, SLA y acción `Gestionar`; el botón flotante vive fuera de ella y no puede recortarla ni modificarla.
- El detalle conserva tres respuestas inmediatas —qué pasó, estado actual y qué sigue— y completa el resumen con situación comercial, inventario, preparación, últimos movimientos y la acción recomendada. Así la columna principal aprovecha su espacio con datos reales y no deja un vacío frente al resumen lateral.
- Seis pestañas separan estrictamente `Resumen`, `Pedido`, `Operación`, `Posventa`, `Pago y factura` y `Cliente e historial`. Solo se monta el contenido de la tarea elegida; la barra admite teclado y desplazamiento horizontal en pantallas estrechas.
- `Gestionar` es una acción independiente en el encabezado: abre estado, etiquetas, impresión, archivo y correo sin confundirse con una sección informativa y solo aparece cuando el usuario posee al menos una de esas capacidades.
- El encabezado no participa en la contracción del área desplazable: conserva título, metadatos, distintivos y acciones completos, sin quedar cubierto por la navegación.
- El resumen decorativo lateral conserva íntegramente su diseño anterior, incluidos total, desglose, pago, factura, CUFE, progreso, datos rápidos y trazabilidad.
- Controles del botón de filtros: 3 pruebas sobre arrastre, anclaje, liberación, persistencia y adaptación horizontal.
- Resumen visual y navegación del detalle: 8 pruebas sobre orden POS entregada, pago pendiente, inventario y acción recomendada, preparación logística, tránsito, preservación del resumen decorativo, navegación accesible y gestión independiente.
- Regresión frontend completa: 29 archivos y 120 pruebas aprobadas; build de producción aprobado con Vite.

## Evidencia de la etapa 7

- Observabilidad operativa: 11 controles sobre privacidad, RBAC, sedes, agregación, señales, índices, aislamiento, umbrales y estados healthy/critical.
- Plan de stress: 350 órdenes, siete escenarios, 140 consultas y concurrencia 14; se valida sin abrir una conexión ni leer `.env`.
- La ejecución real usa MongoDB 7 en réplica dentro de CI y una base `orders_ci_stress` que se elimina al terminar.
- La prueba transaccional reutiliza la autoridad real de `orderLogisticsService`; no implementa una máquina paralela ni modifica inventario físico.
- Los umbrales profesionales son p95 máximo de 2.500 ms, duración total máxima de 120 segundos, crecimiento de heap máximo de 256 MB y cero inconsistencias finales.
- CI conserva por separado el contrato sin base, el plan seguro y la ejecución con réplica para distinguir errores de diseño, aislamiento y comportamiento transaccional.

## Evidencia de la etapa 8

- Contrato de WhatsApp asistido: 15 controles sobre teléfonos, privacidad, contenido, etapas, alcance por sede, RBAC, auditoría e idempotencia.
- Vista previa: 2 pruebas sobre relato, destino enmascarado, enlace preparado, bloqueo y reintento.
- Regresión conjunta del detalle: 25 pruebas de seguridad, logística, historia de la orden y WhatsApp.
- El build de producción compila el flujo completo sin requerir credenciales de Meta.
- CI ejecuta los contratos backend y frontend y nunca abre WhatsApp ni envía mensajes reales.

## Evidencia de la etapa 9

- Contrato RMA backend: 12 controles sobre elegibilidad, ventana, excepción, reserva de cantidades, inspección exacta, inventario, modelos, RBAC, roles, concurrencia y persistencia sin borrados.
- Interfaz posventa: 3 pruebas sobre creación del expediente, clasificación física completa y separación entre bodega y reembolso.
- Regresión del detalle: 11 archivos y 48 pruebas aprobadas, incluido listado, seguridad, logística, cliente, historia, WhatsApp y conciliación.
- Traza RMA persistente sobre MongoDB principal: `npm --prefix backend run demo:orders-returns-trace -- --confirm-persist`. Carga exclusivamente `MONGODB_URI` desde `backend/.env`, exige réplica transaccional y confirmación explícita, y conserva la orden DEMO, solicitud concurrente ganadora, autorización, tránsito, recepción, inspección, kardex, reembolso, reserva y eventos. No ejecuta limpieza automática ni llama Wompi, Factus u otra integración externa. Al terminar desactiva la sede y las existencias DEMO para que sigan auditables sin quedar disponibles para operación comercial. El consecutivo técnico de movimientos avanza porque la evidencia se conserva.
- Traza RMA con facturación electrónica activa: `npm --prefix backend run demo:orders-returns-factus-trace -- --confirm-persist --confirm-factus-habilitacion`. Se bloquea fuera del sandbox oficial de Factus, exige rangos activos de factura y nota crédito, emite y descarga PDF/XML oficiales, enlaza la nota crédito con el reembolso y conserva orden, RMA, kardex y documentos fiscales en la base principal. El pago de esta traza sigue siendo una simulación interna identificada; Factus sí es externo y real en habilitación. No existe limpieza automática.

- Si una ejecución se interrumpe después de emitir la factura, se continúa la misma traza con `--resume-order=<NUMERO_ORDEN>`. Este modo exige las mismas confirmaciones, recupera y verifica la factura existente y reutiliza la clave idempotente de la nota crédito; no crea una orden ni una factura nuevas.

- El comando `diagnose:orders-returns-factus-trace -- --diagnose-order=<NUMERO_ORDEN>` consulta la evidencia y el último rechazo guardado sin escribir en MongoDB ni llamar a Factus.

- La nota crédito envía `bill_number` y el mismo cliente fiscal usado por la factura. Los rechazos HTTP 422 conservan campos y mensajes de validación para permitir recuperación idempotente sin perder trazabilidad.
- Build de producción aprobado con Vite.
- El contrato local `test:orders-returns-factus-trace` inspecciona los bloqueos y enlaces sin llamar transportadoras, gateways, Factus ni bases productivas.

## Evolución Plus · Fase 1

La emisión administrativa dejó de depender de un `window.confirm` global. En `Facturación > Órdenes por facturar`, la acción ahora abre un precontrol fiscal nativo que presenta exactamente el comprador, documento, municipio DIVIPOLA, dirección, correo, conceptos, impuestos, descuentos, envío y total que se enviarán al proveedor.

El backend reconstruye esa fotografía desde las autoridades reales de Orden, configuración, inventario y totales. Una emisión queda bloqueada cuando encuentra, entre otros casos, comprador identificado con el documento genérico `222222222222`, identidad incompleta, municipio ausente para Factus, totales no conciliados, orden no facturable, factura ya validada o emisión en curso. El modo consumidor final solo se admite cuando la orden lo declara expresamente.

Cada revisión genera una huella SHA-256. El administrador debe marcar la confirmación y el `POST` de emisión debe presentar la misma huella. Antes de contactar a Factus, el servicio vuelve a construir el precontrol; si cualquier dato cambió, devuelve `BILLING_PREFLIGHT_CHANGED` y obliga a revisar otra vez. La emisión automática derivada de una pasarela conserva su motor idempotente separado; esta confirmación adicional protege únicamente la acción humana desde administración.

La fase queda protegida por:

- 8 controles backend de precontrol, normalización, RBAC, huella fiscal y enlace E2E;
- 3 pruebas visuales del modal, incluidos bloqueo y resistencia a cierres accidentales;
- 143 pruebas de regresión frontend completa;
- cierre integral de Facturación con 27 bloques aprobados;
- build de producción Vite;
- recorrido E2E Playwright del panel real, con APIs simuladas, que verifica revisión, checkbox, huella y solicitud final sin conectarse a MongoDB ni Factus.

GitHub Actions ejecuta los contratos que antes quedaban solo locales: seguridad, arquitectura, logística, operaciones, historia del detalle, teclado/copiar-pegar, municipio, orden manual y precontrol fiscal. El E2E instala Chromium dentro del runner y usa únicamente respuestas interceptadas; no crea órdenes, facturas ni datos temporales o persistentes.

## Evolución Plus · Fase 2

La automatización de reembolsos y transportadoras conserva un cierre seguro por defecto. Wompi solo intenta un `void` oficial cuando la operación, el ambiente, el valor y el estado remoto cumplen el contrato; efectivo, pagos mixtos, devoluciones parciales y medios no compatibles permanecen como acciones manuales auditables.

Envia se administra desde **Configuración → Envíos** sin exponer credenciales al navegador. Sandbox quedó validado con cotización, selección de tarifa, creación y descarga de etiqueta, entrega física a la transportadora, simulación separada y actualización de seguimiento. El detalle de la orden presenta tres pasos visuales y muestra una sola tarea operativa a la vez.

La preparación para Producción exige simultáneamente:

- token real probado en el ambiente guardado;
- `INTEGRATIONS_ENCRYPTION_KEY` estable y de al menos 32 caracteres;
- secreto HMAC del webhook;
- `BACKEND_URL` HTTPS permanente, nunca `trycloudflare.com`;
- URL registrada en el portal de Envia;
- evento auténtico recibido y validado para esa misma URL y ambiente;
- confirmación explícita antes de crear guías o solicitar recolecciones con costo.

La fase está protegida por 21 verificaciones del adaptador de transportadoras, 10 verificaciones de configuración y seguridad, 6 pruebas del panel de Envia, las pruebas del centro logístico y el build de producción. GitHub Actions ejecuta tanto los contratos del backend como `test:shipping-settings-ui`; ninguna de esas pruebas llama a Envia ni crea guías reales.

El cierre externo de Producción permanece pendiente hasta disponer del alojamiento HTTPS permanente y de las credenciales reales. Esa validación no debe simularse ni realizarse con un Quick Tunnel.

## Prueba persistente del ciclo real Orden–Cliente

El comando `test:orders-customer-lifecycle-live` verifica el recorrido completo contra la base configurada en `backend/.env`. No usa mocks: selecciona una existencia física activa, crea una orden web y su cliente dentro de una transacción, reserva inventario, confirma el pago administrativo, recorre picking, empaque, despacho, tránsito y entrega, corrige el celular sincronizándolo con la ficha maestra y valida CRM, Kardex, auditoría e idempotencia.

La ejecución es deliberadamente persistente: conserva la orden, el cliente, la salida de inventario y sus eventos para revisión desde los módulos Órdenes y Clientes. Descuenta una unidad real de inventario. No llama Wompi ni otra pasarela, no envía mensajes, no genera documentos DIAN y no contiene operaciones automáticas de borrado.

Desde la raíz del repositorio en Windows:

```bat
npm --prefix backend run test:orders-customer-lifecycle-live -- --confirm-real-transaction --label=cliente-real
```

Sin `--confirm-real-transaction` el comando se detiene antes de conectarse. Debe ejecutarse únicamente en una base controlada donde sea aceptable conservar la compra y descontar la unidad seleccionada.

El contrato `test:orders-customer-connection` protege la confirmación obligatoria, la ausencia de borrados, el uso de los servicios oficiales de cliente, inventario, estados y logística, y la actualización de las identidades normalizadas al corregir datos.

## Simulación persistente y trazabilidad visual

El comando `demo:orders-trace` crea recorridos demostrativos permanentes para revisar el módulo desde el panel: pago pendiente con reserva liberada, picking por iniciar, incidencia abierta, tránsito y entrega con evidencia. Cuando existen existencias elegibles en dos sedes distintas, añade una orden multisede y genera un envío independiente para cada sede real.

La ejecución exige `--confirm-persist`, genera un identificador `ord_trace_*` buscable y conserva todas las órdenes creadas. La simulación usa únicamente referencias existentes de productos, existencias y sedes; no inventa una segunda sede. Tampoco descuenta inventario, registra caja, llama pasarelas de pago, genera documentos DIAN ni ejecuta limpieza automática. Cada orden queda marcada como `DEMO`, `system_order` y contiene una nota fija que prohíbe facturarla o despacharla físicamente.

Ejemplo desde la raíz del repositorio:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run demo:orders-trace -- --confirm-persist --label=trazabilidad-ordenes
```

El contrato `test:orders-trace-seed` valida confirmación, límites, identificadores, selección de sedes reales, recorridos logísticos, evidencia demostrativa, ausencia de borrados y ausencia de mutaciones sobre inventario, productos, sedes, caja o facturación.

### Prueba visual de “Preparar logística”

El comando `demo:orders-logistics-eligibility` crea exactamente dos órdenes DEMO permanentes y devuelve un identificador `ord_elig_*` para buscarlas en el panel:

1. una orden con pago pendiente y reserva liberada, en la que `Preparar logística` debe permanecer deshabilitado con el mensaje `Disponible cuando el pago esté confirmado y exista inventario vendido.`;
2. una orden con pago confirmado e inventario vendido, todavía sin envíos, en la que `Preparar logística` debe estar habilitado.

Desde la raíz del repositorio en Windows:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run demo:orders-logistics-eligibility -- --confirm-persist --label=prueba-preparacion
```

Después de buscar el identificador impreso por el comando, se abre primero la orden `BLOQUEADA` para comprobar el mensaje. En la orden `HABILITADA` se pulsa `Preparar logística`; debe aparecer un envío por sede y la acción `Iniciar picking`. Al recargar el detalle, el envío debe conservarse y el botón de preparación no debe volver a mostrarse.

La ejecución exige `--confirm-persist`, no limpia las órdenes creadas y no modifica existencias, caja, pasarelas, DIAN ni transportadoras. El contrato `test:orders-logistics-eligibility-trace` valida los dos escenarios contra el modelo y la regla de negocio reales, además de proteger esas restricciones de seguridad dentro de CI.

## Trabajo pendiente deliberado

1. Integrar generación/compra de etiquetas de retorno con una transportadora real; el RMA actual conserva referencias manuales sin afirmar validación externa.
2. Crear autoservicio del cliente con autenticación fuerte, políticas visibles y seguimiento del RMA.
3. Automatizar la creación de la orden de reemplazo; actualmente el cierre exige enlazar una orden real ya creada.
4. Añadir reglas antifraude y políticas diferenciadas por categoría, mercado o condición comercial.
5. Fusionar la rama mediante revisión controlada después de validar el recorrido RMA sobre una base de staging con réplica.
