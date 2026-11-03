# Suscripciones y retiro de comunicaciones comerciales

Una solicitud de novedades no activa por sí sola una suscripción. El visitante debe autorizar la información vigente y confirmar un código recibido en su correo. El retiro requiere también confirmar el correo y actualiza la decisión de email en Suscriptores y Clientes dentro de una transacción.

La compra y sus notificaciones operativas siguen siendo independientes del marketing. Una orden histórica, una casilla sin versión o una nueva compra no reactivan un permiso retirado. No se convierten los contactos anteriores en suscriptores autorizados ni se crean fichas de Clientes con identidades ficticias a partir de un correo.

## Acceso público y panel

- Los footers editorial y clásico comparten `NewsletterForm`. Conservan su presentación y los ajustes existentes de texto, tamaño y color. El mensaje personalizado de éxito solo se muestra después de confirmar el permiso.
- En `/privacidad`, **Comunicaciones comerciales** permite solicitar el retiro y **Confirmar suscripción pendiente** permite introducir el código iniciado desde una compra. El apartado sigue accesible cuando falla la carga del documento informativo.
- En **Clientes → ficha del cliente → Privacidad**, se muestra el estado específico de novedades por correo y su constancia. Ver el texto completo y la referencia exige acceso a datos sensibles, con los permisos y el ámbito de cliente existentes.
- El permiso comercial general se mantiene separado del permiso de email. Para registrar una autorización documental de email, la administración debe aportar la referencia y marcar que la evidencia incluye ese canal. Retirar el consentimiento comercial general o anonimizar al cliente retira también su suscripción de correo.
- El título del apartado público se edita en **Páginas → Datos personales → Derechos y atención**. La finalidad, la identificación del responsable y la prueba no dependen de un texto decorativo del footer.

## Información y constancia

El servidor construye la autorización con la identidad y los canales del responsable ya configurados en Tienda y Facturación. Reutiliza la política canónica de privacidad y sus valores de conservación, proveedores y vigencia. La suscripción queda deshabilitada si esa información está incompleta; el retiro y la compra sin marketing no exigen aceptar una suscripción.

La versión se calcula sobre el texto, la identidad, el canal y la política comunicados. La prueba confirmada conserva esos contenidos, las fechas de solicitud y confirmación, la fuente, el método y su referencia. Una modificación de contenido invalida un código pendiente; el usuario debe revisar la información nueva.

`Subscriber` mantiene la decisión vigente y las últimas 50 decisiones para consulta rápida. `NewsletterConsentEvent` conserva las constancias duraderas por separado: limitar el historial reciente no borra las pruebas anteriores. `Customer.emailMarketingConsent` proyecta el estado del canal sin ampliar el consentimiento general a otros medios.

Las decisiones confirmadas por el visitante y los cambios administrativos de email actualizan el suscriptor, la constancia y la proyección en Clientes de forma transaccional. Una falla en cualquiera de esas escrituras impide confirmar la operación. La proyección posterior a una compra lee dentro de una transacción para evitar sobrescribir un retiro concurrente.

## Confirmación y seguridad

| Operación | Condición y resultado |
| --- | --- |
| `GET /api/newsletter/policy` | Información pública del responsable, finalidad y versión vigente; respuesta sin caché |
| `POST /api/newsletter/subscribe` | Correo, autorización estrictamente `true` y versión vigente; solicita un código, conserva el estado actual |
| `POST /api/newsletter/request-withdrawal` | Solicita código para el retiro; misma respuesta ordinaria tanto si hay contacto como si no existe |
| `POST /api/newsletter/confirm` | Correo, acción y código; confirma una sola decisión y consume el desafío |

Los códigos tienen seis dígitos, diez minutos de vigencia y un máximo de cinco intentos. Se guarda un resumen HMAC con un propósito específico; no se almacena el código en claro ni se envía en URL. Cambiar de correo o de acción no permite reutilizarlo. El retiro administrativo invalida los desafíos que estuvieran pendientes.

Existe un intervalo de dos minutos entre solicitudes equivalentes; cambiar de finalidad o de versión permite reemplazar un desafío anterior. La API limita las solicitudes por IP y por contacto, y las confirmaciones por IP. Los límites HTTP utilizan memoria del proceso; el vencimiento, los intentos y la exclusión del código consumido se controlan en la base de datos. Una instalación con varias instancias debe considerar un almacén compartido para sus límites de tráfico, sin sustituir las comprobaciones de la base.

El correo usa el servicio SMTP existente de Configuración. Un error de entrega retira el código no entregado y presenta una alternativa mediante Peticiones y reclamos. La solicitud de suscripción de una compra se procesa después de confirmar la transacción de la orden; un fallo opcional de correo no cambia su resultado financiero.

## Datos existentes e índices

Los suscriptores anteriores sin constancia quedan como estado desconocido; no se reconstruyen fechas ni autorizaciones. Los datos de contacto y origen existentes no se sobrescriben al solicitar un código. Un contacto con Cliente pero sin registro de Suscriptor puede verificar su retiro sin crear otro Cliente.

Se corrigieron las expresiones parciales de los índices de contacto: se utilizan `$type` y `$gt` para valores no vacíos, con nombres nuevos que no requieren eliminar índices existentes. El flujo comprueba el índice único de correo antes de realizar sus operaciones y reutiliza un índice compatible que ya exista. Si los registros existentes impiden garantizar esa unicidad, devuelve un error y exige revisión administrativa; no fusiona ni elimina contactos automáticamente.

La documentación primaria de MongoDB enumera los operadores admitidos en [índices parciales](https://www.mongodb.com/docs/manual/core/index-partial/). Las expresiones anteriores con `$ne` no pertenecen a esa lista.

La elegibilidad para un futuro envío comercial debe consultarse mediante `canSendCommercialEmail`: exige estado concedido y prueba del canal email, confirmada por código o respaldada por referencia administrativa. Este cambio no incorpora un motor de campañas. Los correos de pedidos, facturas y soporte no se convierten en comunicaciones comerciales ni se bloquean por un retiro de marketing.

## Organización

- `backend/services/newsletter/policy.js`: finalidad, responsable, versión y contenido de la constancia.
- `verification.js`: solicitud, entrega y consumo del código.
- `consent.js`: decisiones administrativas, proyección en Clientes, consulta de constancia y elegibilidad.
- `indexes.js`: definición y comprobación de unicidad del correo.
- `NewsletterConsentEvent` y `newsletterConsentProof`: persistencia de evidencia.
- `orderCreationNewsletterService.js`: conexión posterior a la compra; la orden conserva la intención y el texto comunicado, sin conceder permiso por su cuenta.
- `NewsletterForm` y `useNewsletterPolicy`: flujo compartido entre diseños y página de privacidad.
- `CheckoutNewsletterChoice`: autorización opcional y versión enviada por el comprador.

## Comprobación en una instalación

1. Actualizar la rama y reiniciar el backend. Comprobar que Configuración contiene los datos reales de privacidad y un SMTP operativo.
2. Solicitar novedades con un correo propio desde el footer. Antes de confirmar el código, no debe aparecer permiso de email concedido.
3. Confirmar el código. Si existe una ficha con ese correo, comprobar su constancia en Clientes → Privacidad.
4. Abrir Datos personales, solicitar el retiro y confirmarlo con su código. Comprobar el estado retirado en Clientes.
5. Hacer una compra sin novedades: el retiro debe mantenerse. Marcar novedades de nuevo solo debe iniciar otra confirmación, sin reactivar automáticamente.
6. Probar un código incorrecto, vencido o ya utilizado, y revisar el acceso desde móvil.

Las pruebas de desarrollo utilizan transporte de correo y datos controlados. La entrega por SMTP real y las condiciones de la base desplegada requieren la comprobación anterior. Los contratos de pruebas están en `backend/scripts/testNewsletterConsent.js`, las pruebas de interfaz del formulario y sus consumidores, y `frontend/e2e/newsletterConsent.e2e.js`.

Este paso resuelve la implementación de suscripción, confirmación y retiro. El inventario de conexiones externas, los plazos de conservación del navegador, la revisión de proveedores y la política con datos efectivos del negocio continúan en las etapas siguientes del diagnóstico de cumplimiento.

## Validación de esta entrega

- 133 pruebas de interfaz en 27 archivos: formularios, dos footers, privacidad, Checkout, editor y Clientes.
- 20 grupos del contrato de suscripción: versión, falta de autorización, confirmación, retiro, propiedad del correo, intentos, caducidad, repetición, simultaneidad, reversión ante fallo de Clientes, cambios administrativos, correo fallido, historial duradero e índices. El contrato incluye HTTP real con servidor Express y respuestas de correo y persistencia controladas.
- Regresiones: 14 controles de creación posterior a la compra, 40 de conexión Órdenes–Clientes, 26 de privacidad de Clientes, 17 grupos de protección al consumidor y cuatro escenarios de política y huella histórica sin cambios.
- Ocho recorridos Chromium de suscripción, confirmación y retiro, combinando los dos footers con 1536, 768, 390 y 320 px. Sin desbordamiento horizontal en los recorridos comprobados.
- Compilación de producción y comprobación de diferencias correctas.

Las pruebas no envían mensajes a personas ni conectan con la base de datos privada. No certifican la entrega SMTP real ni reparan posibles duplicados históricos en otra instalación.
