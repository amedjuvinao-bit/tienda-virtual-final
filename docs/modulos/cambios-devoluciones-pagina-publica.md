# Cambios y devoluciones — página pública

La página `/cambios-y-devoluciones` presenta tres opciones de atención, un recorrido de tres pasos, acceso a PQR y consulta de radicados. Conserva el fondo continuo de Inicio, el header/footer configurados y el material de vidrio de Contacto y Envíos. La dirección anterior `/cambios-devoluciones` mantiene su redirección existente.

## Contenido y conexión con el negocio

- **Quiero un cambio** abre la política comercial vigente y la garantía, junto con orientación para usar el enlace autorizado del pedido. El enlace de atención predeterminado abre PQR como Petición.
- **Mi producto tiene un problema** abre la información de garantía y el enlace a PQR con Garantía legal preseleccionada.
- **Quiero devolver mi compra** permite consultar retracto y reversión y abrir PQR con Retracto preseleccionado. La reversión conserva su explicación independiente; no se confunde con un reembolso automático.
- **Consultar solicitud** abre PQR directamente en su pestaña de consulta. Sigue requiriendo radicado y clave privada; el enlace no contiene credenciales ni autoriza el acceso a una compra.

Abrir una opción no radica, acepta condiciones, crea devoluciones ni modifica pagos. Las condiciones legales, la identidad y la política comercial se leen del endpoint existente de información del consumidor. La política comercial de Órdenes sigue siendo la fuente; no se crea otro formulario administrativo para ella. La vinculación de PQR a una compra conserva la verificación existente del servidor y sus cabeceras de acceso. No se deduce propiedad de un pedido por su número escrito.

Las condiciones completas y su descarga permanecen disponibles aunque se oculten las tarjetas o la franja de ayuda. El desplegable usa un marco externo para que su borde de vidrio también se vea cerrado. Las descargas conservan la referencia íntegra del documento; las constancias históricas y las reglas de aceptación no se modifican. El enlace a la SIC y la explicación comprensible de la referencia se conservan.

La orientación no inventa periodos comerciales, cobertura de garantía, cambios gratuitos, aprobación automática ni avisos automáticos al cliente. Las descripciones pueden personalizarse y deben concordar con la operación y las condiciones publicadas.

## Administración

En **Páginas → Cambios y devoluciones**, el editor reutiliza guardado, descarte, control de subida y vista previa fija. Los temas específicos son:

1. **Opciones de atención**: editar una tarjeta a la vez, su icono, título, descripción, botón, visibilidad y destino de solicitud. Las identidades de las tres opciones son estables para mantener la relación correcta con sus condiciones.
2. **Pasos de la solicitud**: seleccionar y editar uno de los tres pasos.
3. **Ayuda y condiciones**: textos y destinos de atención/consulta, títulos de condiciones, mensajes y descarga.
4. **Composición de cambios**, en Diseño: ilustración, tamaño, texto alternativo, tipografía editorial, movimiento y secciones adicionales.

Los temas comunes administran colores, brillo, transparencia, contornos, radio, fondo continuo o propio, imágenes de fondo, tipografía y medidas. Las imágenes se cargan desde el equipo mediante `AdminImageUploadField` y la integración existente con Cloudinary. No se exige introducir la URL de una imagen.

Se preservan extensiones, textos, colores, material e imágenes propios. Solo se reconoce la semilla inicial exacta para adoptar el título, subtítulo y tamaño de la propuesta; no se sobrescribe una presentación personalizada. Los arrays explícitamente vacíos y las imágenes eliminadas se mantienen. Una página de otro tipo no recibe configuración de cambios de manera involuntaria.

Los enlaces inseguros o administrativos se rechazan al guardar; las opciones o pasos visibles incompletos también se validan. Las acciones de navegación y descarga de la vista previa están bloqueadas. Los cambios visuales no habilitan operaciones reales.

## Organización técnica

`ReturnsGuideContent` contiene la vista; `returnsGuideConfig` normaliza y valida la configuración `informationPageConfig.returnsGuide`; `returnsGuide.css` limita estilos a esta página. `ReturnsGuideAppearanceControls` organiza sus temas del editor. La persistencia usa el campo Mixed existente del CMS, sin migración de pedidos ni cambios del esquema del servidor.

`ConsumerPageContent` conserva su consulta compartida al servidor y delega la vista del rol `consumer-returns`. `caseNavigation` admite únicamente `vista=consulta` y tipos presentes en el catálogo recibido del servidor. El resto de parámetros no concede acceso ni sustituye los controles existentes.

Se usan los contornos medidos de `ContactGlassRim`; no hay una superficie blanca opaca ni una imagen de página completa fingiendo controles. Los paneles se redistribuyen en móvil, el código de referencia puede partirse sin desbordar y se conserva la navegación con teclado, el foco al cerrar una opción y la preferencia de movimiento reducido.

## Recurso visual

Propuesta aprobada, utilizada como fuente exacta: `/workspace/scratch/8cbd4873f312/upload/image-edit-target-480e6ed334d1633b.png`.

Generación mediante la herramienta integrada **ImageGen**, con fondo transparente. Original preservado: `/workspace/scratch/8cbd4873f312/generated_images/exec-f973222a-71f1-445d-9ee8-d8dc5c028acd.png`. Recurso servido: `frontend/public/returns/crystal-exchange.webp` (247 012 bytes). Solo se convirtió PNG a WebP (calidad 88, método 6), sin recorte ni cambios de composición; el canal alfa conserva la transparencia. Es una ilustración decorativa, sustituible desde el panel, no una fotografía del negocio.

Prompt utilizado:

> Use case: background-extraction / precise-object-edit. Input image 1 is the exact approved website design edit source. Produce only the decorative hero illustration visible at its upper right: the clear rose-tinted optical glass parcel tied with a deep burgundy satin bow, with two delicate clear blush exchange arrows curving around it and a small blush rose with two fallen petals at its lower left. Match the exact object, arrangement, colors, realistic glass refraction and lighting from this source as closely as possible. Remove the website interface, all text, panels, borders, floor, room, backdrop, logos, and any rectangular or white surface. Deliver one isolated decorative illustration with a genuinely transparent alpha background. Do not add a white opaque box behind or inside the object: glass is translucent clear pale rose, with thin bright edge highlights and real see-through faces. Whole illustration fully visible, including arrowheads, petals and bow, centered with modest transparent margin, no cropped objects, no text, no watermark. This is a reusable web illustration, not a full-page screenshot.

## Validación

Pruebas frontend de opciones, condiciones/descarga íntegra, configuración, enlaces inseguros, vista previa, recuperación de error, navegación a PQR, consentimiento no preseleccionado, guardado/recarga y bloqueo durante subida; regresión de páginas informativas, Envíos y editores. Contratos del servidor de protección al consumidor y acceso/recuperación/conexión de PQR. Compilación Vite y recorrido Chromium con APIs controladas en 1536, 1024, 768, 390 y 320 px, incluyendo destino y tipo correcto de las tres solicitudes, consulta directa, teclado, descarga, vista previa fija, persistencia y recuperación de un fallo de información.

Las pruebas no radican solicitudes reales, no envían correos y no modifican pedidos ni pagos. El cambio de presentación no certifica el cumplimiento integral de la operación ni cierra las etapas legales y logísticas pendientes.

Resultado del cierre: **60 pruebas frontend en 13 archivos**, **17 grupos de protección al consumidor**, **11 grupos de acceso y conexión de PQR**, **16 controles Chromium** y compilación Vite correctos.
