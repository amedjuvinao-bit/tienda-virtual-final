# Peticiones y reclamos — presentación pública

La página `/pqr` adopta el diseño aprobado: cabecera con ilustración de sobre de vidrio, tres acciones principales, formulario y guía lateral, fondo continuo de Inicio y contornos de cristal compartidos con Contacto, Envíos y Cambios. Mantiene el header y footer configurados. En móvil, las acciones se apilan y la guía queda después del formulario.

## Recorridos conservados

- **Nueva solicitud** conserva nombre, contacto, tipo, pedido opcional, asunto y descripción. El correo opcional de constancia/recuperación y el medio de devolución solicitado se agrupan dentro de **Datos opcionales**; permanecen en el formulario y se incluyen en la solicitud aunque el desplegable esté cerrado. Una validación nativa fallida de un dato opcional vuelve a abrirlo para que el usuario pueda corregirlo.
- La autorización de datos permanece obligatoria, expresa y sin preselección. Sigue enviando la versión de la política del servidor. Si cambia, se desmarca y se refresca la información antes del reintento.
- Se conserva el bloqueo de concurrencia, la misma clave y el mismo cuerpo de solicitud al reintentar una radicación incierta, los errores recuperables y la validación del acceso a una compra. Las funciones de transporte de radicación y consulta no fueron modificadas.
- **Consultar solicitud** conserva la consulta por POST con radicado y clave. `/pqr?vista=consulta` abre directamente ese recorrido y `/pqr?tipo=warranty` mantiene la preselección del tipo autorizado por el catálogo del servidor.
- **Recuperar acceso** conserva radicado, correo registrado, código, lectura protegida de los datos tras solicitarlo, renovación de clave y constancia. Si el contacto era solo teléfono, se mantiene la orientación hacia Contacto para asistencia e identificación. No se envían códigos a un correo arbitrario.
- Se conservan fecha, estado, texto, vínculo verificado a la compra, historial de respuestas, estado real del correo y descarga de constancia/clave. No se incluyen claves en enlaces ni se publican listados de solicitudes.

Los datos empresariales y la política de privacidad siguen viniendo del endpoint existente. Se pueden consultar y descargar desde **Datos del vendedor y atención al consumidor**. El enlace a la SIC y la explicación de la referencia del documento permanecen accesibles. La presentación no ejecuta pagos, cambios o reembolsos ni anuncia respuestas automáticas.

La navegación de la vista previa es interactiva para comprobar sus estados, pero los formularios, la recuperación, los enlaces de salida y las descargas permanecen bloqueados. Se siguen utilizando los procesos de Órdenes y PQR ya existentes; no se crea otra bandeja ni otra configuración empresarial.

## Administración agrupada

En **Páginas → Peticiones y reclamos**, el editor ofrece:

1. **Formulario y campos**: selector de un campo a la vez para su etiqueta y ayuda; texto del desplegable opcional y orientación al enviar. Los nombres internos, requisitos, límites, catálogo de tipos y autorización conservan su función.
2. **Pestañas y mensajes**: presentación y botones de radicación, consulta, recuperación, carga y descarga, organizados en grupos desplegables.
3. **Guía y contacto**: texto de la guía, edición de un paso a la vez, recordatorios, consejo de seguridad y enlace de contacto.
4. **Composición de PQR**, en Diseño: ilustración mediante carga desde el equipo a Cloudinary, medidas, guía, campos de vidrio, radio, contorno, tinte, difuminado y movimiento.

Los temas comunes controlan título, colores (incluidos tinte/texto/borde de campos), fondo continuo o propio, brillo, transparencia y contornos generales. La vista previa conserva su posición fija durante el desplazamiento. El guardado y la navegación siguen bloqueados mientras se sube una imagen.

La semilla inicial exacta adopta el subtítulo y tamaño de la propuesta; los textos, colores, material, imágenes borradas y extensiones propios se conservan. Una página ajena a PQR no recibe `claimsPage` ni cambia sus colores de entrada por este ajuste. Los enlaces de contacto inseguros, pasos visibles incompletos y etiquetas vacías se rechazan antes de guardar. Los mensajes operativos, comprobaciones y autorización no pueden sustituirse por ocultar un campo requerido.

## Organización

- `ClaimsPageContent`: cabecera, estados de carga/error, datos del vendedor, política y descarga.
- `ConsumerCaseForm`: mismos estados y transporte de radicación/consulta; nueva distribución y datos opcionales agrupados.
- `ConsumerRecoveryForm`: mismo transporte y verificación; nuevos campos de presentación.
- `ConsumerCaseField`: campos nativos con etiquetas, iconos decorativos y borde medido de vidrio.
- `ConsumerCaseGuide`: orientación lateral sin operaciones ni datos privados.
- `claimsPageConfig`: normalización y validación de `informationPageConfig.claimsPage`.
- `ClaimsAppearanceControls`: temas del editor. La persistencia reutiliza el campo Mixed existente del CMS, sin migración de pedidos o solicitudes.

Los estilos se limitan a `.claims-page`. Se utilizan `ContactGlassRim` y los controles de material existentes, con reflejos en el perímetro. Los campos conservan controles nativos, foco visible, autorización accesible y desplazamiento sin desbordar. Se respeta la preferencia de movimiento reducido.

## Ilustración

Se usó la propuesta aprobada como fuente: `/workspace/scratch/8cbd4873f312/generated_images/exec-640b2b47-85ec-4c8c-9ec5-4835f499dbd0.png`.

Modo: herramienta integrada **ImageGen**, fondo transparente. Original conservado: `/workspace/scratch/8cbd4873f312/generated_images/exec-7bf004af-9079-4fe2-96b0-dd1d0aeb9e38.png`. Archivo servido: `frontend/public/consumer/crystal-envelope.webp` (287 410 bytes), convertido de PNG a WebP con calidad 88 y método 6, sin recorte ni cambios de composición. El alfa conserva transparencia de 0 a 255. Es una ilustración decorativa sustituible desde el panel, no una fotografía del negocio.

Prompt final:

> Use case: background-extraction / precise-object-edit. The input is the approved Peticiones y reclamos UI mockup. Extract and faithfully recreate ONLY its decorative hero illustration at the upper right: clear pale blush optical glass envelope with a deep burgundy ribbon and rose wax seal, one little clear glass speech bubble at its upper right, small blush rose and a few small petals along its lower left. Preserve the exact object composition, style, color, scale relationships and realistic polished-glass edge refraction from the reference. Remove ALL interface elements, writing, panels, room/floor, rectangular surfaces, and backdrop. Deliver an isolated web illustration with genuinely transparent alpha background, generous enough clear margins so envelope and speech bubble are fully visible, no cropping, no opaque white rectangle, no black patch, no white haze covering the entire surface, no text or watermark. Glass faces are subtly translucent blush and see-through; highlights are localized around the thin glass edges. No package box. One decorative envelope illustration only.

## Validación

- **67 pruebas frontend en 14 archivos**, incluidas radicación y reintentos, consentimiento versionado, consulta, recuperación, datos opcionales, vista previa, configuración, guardado/recarga, subida, enlaces y regresión de páginas informativas.
- **17 grupos** del contrato de protección al consumidor y **11 grupos** de acceso, recuperación y conexión de PQR.
- **18 controles Chromium** con APIs controladas: 1536/1024/768/390/320 px, validación nativa con datos opcionales cerrados, reintento con cuerpo/clave idénticos, consentimiento, descarga, consulta de respuestas, recuperación y cambio de clave, enlaces, movimiento reducido, editor, vista previa fija y recuperación de fallos.
- Compilación Vite correcta. Verificación de que las funciones de envío/consulta conservan su implementación anterior.

No se radicaron solicitudes reales, no se enviaron correos y no se modificaron pedidos ni pagos. La presentación no certifica el cumplimiento integral de la operación y no cierra las etapas legales o logísticas acordadas para después de las páginas.
