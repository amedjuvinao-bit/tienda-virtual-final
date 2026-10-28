# Protección al consumidor y condiciones de compra

Implementación en `feature/paginas-nivel-plus`. Marco consultado el 27 de octubre de 2026: Ley 1480 de 2011 (arts. 7–11, 47–51 y 58), Ley 2439 de 2024 y Ley 1581 de 2012. La compilación vigente incorpora la sentencia C-192/26 en el artículo 47.

## Dónde se administra

- **Configuración → Tienda**: datos de contacto, dirección y pestaña Privacidad para vigencia, conservación y proveedores de tratamiento.
- **Facturación → Configuración**: razón social y NIT, reutilizados en las páginas y en la compra.
- **Configuración → Envíos → Plazo y recogida**: destinos y compromiso general de entrega.
- **Órdenes**: entregas, cambios, devoluciones y política comercial existente; pestaña Peticiones y reclamos para recibir y responder solicitudes.
- **Páginas**: Envíos y entregas, Condiciones de compra, Datos personales, Retracto/garantía/devoluciones y Peticiones y reclamos. Se reutilizan el editor por temas, el borrador, la carga de imágenes y la vista previa. Las secciones complementarias no sustituyen los derechos legales.
- **Configuración → Envíos**: tarifas, zonas y envío gratuito. La tarifa de la transportadora no se consulta automáticamente al comprador. Envia conserva su integración logística administrativa existente.
- **Órdenes → Peticiones y reclamos**: consulta y respuesta pública de radicados. Acceso global reservado a propietario y administradores; no se conceden datos de todos los compradores a operadores de una sede.

## Datos que debe completar el responsable

No se inventan NIT, identidad jurídica, dirección, fecha de vigencia, política de conservación ni proveedores de tratamiento. La razón social y el NIT se leen de la información fiscal; los contactos y la dirección, de Tienda. La privacidad se configura una sola vez en Tienda. El checkout bloquea la confirmación si faltan datos necesarios. Esto requiere actualización coordinada de backend y frontend.

Los destinos existentes se recuperan de la configuración anterior o de los países de las zonas; si no hay países informados, el valor inicial es CO. El responsable puede configurar otros códigos de dos letras. Esta es una decisión operativa configurable, no una prohibición legal de exportar. El retiro no se ofrece hasta habilitarlo e informar instrucciones.

El plazo operativo admite 1–30 días calendario e incluye preparación y transporte. Sin plazo particular se informa expresamente el plazo legal supletorio de 30 días desde el día siguiente a la comunicación del pedido. No se anuncian 2–7 días ni cobertura nacional automáticamente. El envío gratuito no altera el plazo.

## Compra y prueba de aceptación

`orderPricingService` calcula productos, precios, impuestos, descuentos y envío en servidor. La cotización incluye `consumerOffer`: identidad del vendedor, reglas aplicables, información de productos, destino, fecha máxima de entrega y huella SHA-256. Las descripciones se obtienen del producto del servidor, no del carrito enviado por el cliente.

El comprador revisa el resumen y toma dos decisiones sin preselección: aceptar las condiciones y autorizar el tratamiento informado para la compra. El consentimiento de marketing conserva su control independiente y opcional.

La transacción reconstruye la oferta desde la configuración y los productos actuales y exige la misma huella y las dos decisiones expresas antes de persistir la orden. Una modificación de total, producto, plazo, destino, versión o fecha exige revisar y aceptar otra vez. El frontend recotiza al recibir `CONSUMER_OFFER_CHANGED`. El mecanismo no sustituye la autorización segura del carrito ni su comparación atómica: ambas validaciones se mantienen.

La orden conserva `consumerContract`, su fecha de aceptación y la fotografía de condiciones y precios. La huella forma parte de la identidad idempotente de la creación. Los reintentos devuelven la fotografía original y las órdenes anteriores no se rellenan con una aceptación ficticia.

La respuesta de creación contiene la recepción del pedido y la fotografía contractual. El acceso seguro existente a Gracias permite recuperar y descargar esa constancia después de la compra, incluso cuando se ocultan los detalles estéticos del resumen. La recepción del pedido no acredita un pago aprobado. No se declara implementado un envío automático de correos de confirmación; se conserva el envío administrativo de correo existente.

## Radicación y seguimiento

El footer público, en sus variantes editorial y clásica, incluye un acceso directo «Peticiones y reclamos · PQR» a `/pqr`, fuera de los grupos plegables y antes de la firma inferior. Permanece visible aunque las columnas configurables estén vacías u ocultas. Si existe un enlace `/pqr` personalizado en las columnas, el acceso toma su nombre. En la vista previa del panel no navega. La franja global conserva el acceso de respaldo cuando una página no muestra footer.

`POST /api/consumer/cases` admite solicitudes con o sin pedido. Distingue petición, queja/reclamo, incumplimiento de entrega, retracto, garantía, reversión, consulta de datos y reclamo de datos. No aplica los filtros ni la ventana de cambios comerciales del portal RMA a la recepción de estas solicitudes.

Se conserva la solicitud, la autorización informada vigente, el medio de devolución preferido si se informa, el radicado y la fecha/hora. La constancia descargable permite acreditar su texto y consultar posteriormente. Las fechas se muestran en hora de Colombia.

La clave privada de seguimiento usa 32 bytes aleatorios y solo se guarda su hash en MongoDB. No se coloca en URLs ni se guarda en localStorage. El cliente debe conservar la constancia. La consulta se hace por POST con radicado y clave. No existe un listado público ni una búsqueda por cédula, correo o número de pedido.

Los reintentos conservan la misma clave y carga: una respuesta de red incierta no genera otra solicitud. Los índices únicos de referencia y hash evitan duplicados concurrentes. Como producción desactiva `autoIndex`, la primera radicación espera `ConsumerCase.createIndexes()`; solo crea índices declarados en esta colección y no elimina/sincroniza índices ajenos. Un fallo de índices impide la escritura. Reiniciar el servidor no elimina los radicados: se guardan en MongoDB.

### Recuperación de acceso

La radicación envía una constancia y la clave mediante el correo configurado en **Configuración → Correo**. Se usa el correo de contacto o el correo de recuperación opcional que indicó el cliente. Un fallo SMTP no elimina el radicado ni lo duplica: se informa al cliente y sigue disponible la descarga. El envío de esta constancia de PQR se intenta una vez por radicado; no equivale al acuse de un pedido ni activa correos comerciales.

**Recuperar acceso** solicita radicado y correo registrado. La respuesta no revela si existen. El código de seis dígitos se envía exclusivamente al correo guardado, caduca en 10 minutos y admite cinco intentos. Se almacena su HMAC con un secreto existente de la aplicación, nunca el código en claro. Hay limitación por IP y dos minutos entre envíos por radicado. Una confirmación válida rota la clave de seguimiento y revoca la anterior; los reintentos de una respuesta de red perdida conservan la misma nueva clave. La clave original se mantiene únicamente como identidad de radicación para impedir duplicados y ya no permite consultar ni recuperar contenido por reenvío del formulario.

Para solicitudes antiguas con correo se reutiliza ese contacto. Si el cliente registró solo teléfono, el propietario o administrador puede usar **Asistir a un cliente que perdió su clave**, comprobar su identidad por el contacto registrado y describir cómo lo verificó. La operación conserva fecha, operador y motivo, invalida códigos pendientes y genera una constancia de acceso que debe entregarse al cliente por ese canal verificado. Las claves no se guardan en claro ni se entregan por búsquedas públicas. La comprobación de identidad y la entrega asistida son acciones del operador.

### Conexión con la compra

Desde Gracias y el portal de devoluciones se puede abrir PQR con el identificador de la compra. Las credenciales existentes se transmiten en cabeceras, nunca en el enlace. El servidor verifica el acceso de pago o de devoluciones antes de guardar el vínculo y usa el número canónico de la orden. No confía en el número escrito por el navegador ni modifica el estado de entrega, cambio o reembolso.

En el detalle de cada orden, la pestaña **Peticiones y reclamos** muestra sus radicados verificados y las referencias pendientes cuyo número indicado coincide exactamente. Estas últimas se distinguen expresamente y requieren comprobación de identidad antes de crear el vínculo. La vinculación administrativa usa revisión optimista y registra fecha y operador. Las solicitudes sin compra siguen admitidas en la bandeja general.

Los listados se actualizan cada 20 segundos y al recuperar foco. Se conserva la selección y se omite la actualización cuando hay una respuesta en edición; una respuesta de red iniciada antes de escribir tampoco reemplaza su revisión. Cambiar de pestaña o cerrar el detalle pide descartar una respuesta sin guardar. Tanto la bandeja general como las operaciones de PQR dentro de una compra se reservan a propietario y administradores.

Las respuestas requieren revisión optimista y texto público. Se conserva el historial con fecha, estado y actor administrativo; el consumidor recibe solo su información y las respuestas públicas, sin identificadores internos del operador. La radicación y el registro de una respuesta no ejecutan un reembolso ni marcan un pago como devuelto.

## Operación que debe cumplir el negocio

- Mantener información suficiente, veraz y actualizada de cada producto, incluidos los requisitos especiales de su categoría y sus condiciones de garantía. Una imagen o la validación del código no demuestran por sí solas el cumplimiento de requisitos sectoriales.
- Revisar los radicados y responder dentro del plazo correspondiente. La reclamación directa y los reclamos completos de datos tienen reglas de 15 días hábiles; las consultas de datos, 10 días hábiles. Las prórrogas de datos requieren los avisos y motivos legalmente previstos. No se calcula un vencimiento hábil ficticio ignorando los festivos.
- Informar de inmediato una falta de disponibilidad. Una segunda fecha de entrega requiere solicitud del consumidor; no se cambia silenciosamente la fotografía contractual original.
- Ante incumplimiento de entrega o indisponibilidad, gestionar la terminación y la devolución íntegra en el máximo legal de 15 días calendario cuando corresponda. En retracto, el plazo de devolución de dinero se cuenta con los requisitos de datos y devolución cumplidos. No imponer saldo a favor ni descontar cargos no permitidos.
- Gestionar reembolsos mediante la operación de la orden y el medio que prefiera el consumidor conforme a las reglas aplicables, verificando que se hagan efectivos. Una respuesta en PQR no equivale a pago.
- Tramitar correctamente la reversión con los actores del pago; el consumidor también debe notificar al emisor en el plazo legal. El formulario no promete reversión automática.
- Aplicar garantía legal independientemente de los beneficios comerciales. La ventana general del RMA no es una caducidad universal de derechos; desde ese portal se ofrece el canal de reclamación general.
- Aplicar la política de datos declarada, los acuerdos con encargados y las obligaciones de conservación, seguridad y transferencias. Evaluar obligaciones tributarias, sectoriales y registrales según las características reales del responsable y de los productos.

La antigua dirección `/admin/configuracion/consumidor` redirige a Tienda → Privacidad. No hay una segunda pantalla de identidad ni una segunda política comercial. `shippingDelivery` contiene las condiciones editadas exclusivamente desde Envíos; los valores de la versión anterior se conservan como respaldo hasta guardar allí. El formulario de privacidad solo puede modificar sus tres campos y su revisión, sin sobrescribir la entrega. La política pública de cambios y la fotografía de compra leen `OrderReturnPolicy`, con su revisión vigente.

La implementación cubre los vacíos técnicos identificados en compra, información y atención. No certifica por sí sola toda la operación jurídica, tributaria o sectorial de la empresa ni inventa verificaciones en el entorno productivo.

## Fuentes primarias

- https://normograma.mintic.gov.co/mintic/compilacion/docs/ley_1480_2011.htm
- https://normograma.superservicios.gov.co/NORMOGRAMA/compilacion/docs/ley_2439_2024.htm
- https://cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm
- Autoridad de protección al consumidor: https://www.sic.gov.co/

## Validación

`node backend/scripts/testConsumerProtectionContract.js`: reglas de aceptación, fechas, cambios de oferta, ausencia de información inventada, radicación, concurrencia, reintentos, privacidad, seguimiento y protección del rol. Las pruebas usan modelos controlados, no datos ni pagos reales.

Pruebas frontend de consumidor, checkout, páginas informativas, Gracias y devoluciones; compilación Vite y recorrido Chromium con API controlada de información, radicación, consulta, configuración, respuesta pública y presentación móvil.

Pruebas adicionales: `node backend/scripts/testConsumerCaseAccess.js` cubre caducidad, intentos, concurrencia, reintentos, revocación, transporte fallido, acceso firmado a la compra, vinculación y recuperación asistida. Los correos y modelos se sustituyen por dobles de prueba; no se envían mensajes a clientes.
