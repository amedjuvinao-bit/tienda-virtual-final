# Contacto: canales, horarios y ubicación

Contacto utiliza la composición aprobada: título editorial y canales a la izquierda, WhatsApp destacado, filas de correo y horario, y un panel de ubicación a la derecha. En móvil se convierte en una columna. El fondo y el pie continúan la apariencia de Inicio o usan los fondos propios seleccionados en el editor.

## Identidad y rutas

`/contacto` abre la página informativa con el rol interno `contact`. Se crea por inserción atómica únicamente si la dirección todavía no existe. Una página anterior conserva su autoría, bloques y configuración. Las solicitudes de creación y edición no pueden asignar un rol interno ni convertir otra página en Contacto. La página del sistema conserva su dirección y tipo, y no puede eliminarse; sus datos, nombre, visibilidad y apariencia son editables.

`/nuestra-sede` abre primero una página propia con esa dirección; cuando no existe, utiliza Contacto y muestra su ubicación. `/pagina/contacto` sigue disponible. El selector de destinos del encabezado y el listado administrativo resuelven Contacto a su ruta pública real. El destino predeterminado de Contacto del pie editorial pasa de la sección de Inicio a `/contacto`; los enlaces personalizados del negocio se conservan.

El enlace Contacto del checkout abre esta página en otra pestaña para conservar la compra. Deja de utilizar el modal anterior con datos fijos. Las demás políticas y sus editores conservan su ámbito; esta entrega no redacta ni crea políticas de envío, privacidad o términos del negocio.

## Datos comerciales y acciones

La configuración se guarda en `informationPageConfig.contact`, dentro de la colección de páginas existente. Los cuatro orígenes de datos son independientes: WhatsApp, correo, horarios y ubicación pueden heredar Tienda o personalizarse en esta página.

- **WhatsApp:** usa el número comercial y, como alternativa, el número del control global de WhatsApp habilitado. Abre la conversación con el mensaje configurado y codificado. El visitante confirma el envío en su aplicación.
- **Correo:** prioriza el correo de atención de Tienda sobre el general. Prepara un `mailto:` con destinatario y asunto. No envía correos desde el navegador ni muestra una confirmación de envío ficticia.
- **Teléfono opcional:** abre `tel:` con el número configurado o el teléfono comercial.
- **Horarios:** el botón abre un diálogo con los días, hasta dos turnos por día, los cierres y la zona horaria guardada en Tienda. También admite un horario propio en texto. No calcula ni anuncia disponibilidad en tiempo real.
- **Ubicación:** el panel y su marcador abren la búsqueda de la dirección completa en Google Maps. Cómo llegar abre indicaciones con ese destino. No se usa la ciudad sola como ubicación del negocio.
- **Copiar dirección:** escribe la dirección en el portapapeles cuando el navegador lo permite, confirma el resultado y ofrece un mensaje útil si falla.
- **Mapa dentro de la página:** unas coordenadas válidas permiten cargar OpenStreetMap al pulsar Explorar mapa. Puede cerrarse y descargarse. El enlace externo permanece disponible. No se solicita geolocalización al visitante ni se adivinan coordenadas por ciudad.

Los enlaces se construyen a partir de valores validados, no de HTML ni de direcciones ejecutables. Los mensajes y parámetros se codifican. Se valida el correo, el número, la pareja de coordenadas y sus límites antes del guardado. Los canales sin datos válidos se ocultan en público. Un dato personalizado vacío no recupera silenciosamente el dato heredado. El estado sin canales es configurable.

La vista cartográfica de cristal es ilustrativa y lo indica expresamente. Su marcador no representa calles reales. Con coordenadas, el mapa interactivo se ofrece como acción independiente; sin ellas, el destino externo se busca por la dirección publicada. Los datos de ejemplo solo se muestran en la vista previa cuando faltan canales, están identificados y no se añaden al borrador ni al guardado.

## Editor y material

Páginas → Contacto agrupa título y presentación, canales de contacto, horarios, ubicación y mapa, textos de contacto, composición, fondo y cristal, colores, medidas, visibilidad y publicación. Los temas del diario se muestran únicamente en su diseño. El editor compartido admite resolver sus temas según el diseño sin cambiar el comportamiento de los demás editores.

Los datos comerciales continúan en Configuración → Tienda. El editor de Contacto puede heredar cada grupo o reemplazarlo. Las fotos de título y fondos utilizan el selector de archivos y Cloudinary existentes; no se introduce ningún campo de URL para imágenes.

`ContactPageContent`, `ContactMap`, `ContactHoursDialog`, `ContactMaterial`, `ContactGlassRim` y `contactPageConfig` separan composición, acciones, diálogo, material y normalización. El marco usa contornos SVG medidos según el tamaño y radio reales, degradados locales y reflejos limitados al perímetro. No pinta una superficie blanca encima del fondo. Colores, tinte, transparencia, desenfoque, grosor, reflejo, radio y profundidad se administran con los controles compartidos; los valores cero se conservan. El relieve no depende de rasterizar la imagen de propuesta.

El diálogo conserva el desplazamiento, limita el foco, permite Escape y devuelve el foco al botón de horarios. Los controles tienen foco visible. Se respeta movimiento reducido y la opción de desactivar animaciones. La vista previa bloquea enlaces externos, cargas de mapas externos y escritura en el portapapeles; permite probar la organización y el detalle de horarios.

## Verificación

Las pruebas cubren adopción, conservación de extensiones, herencia y reemplazo de datos, canales malformados, horarios semanales, coordenadas cero e incompletas, enlaces y parámetros, portapapeles, diálogo, mapas bajo demanda, aislamiento de ejemplos, editor, guardado y validación. Los contratos del backend cubren creación, duplicados, persistencia anidada, identidad protegida, direcciones reservadas, páginas anteriores y alias propios.

La comprobación del navegador utiliza App, encabezado, pie, editor e iframe reales con datos controlados. Verifica apertura de destinos, horario y foco, portapapeles, mapa bajo demanda, 320–1536 px, fondo continuo, acceso desde Inicio y el pie, guardado y recarga, material editable, valores cero y estado sin canales. Los destinos externos se interceptan en esa comprobación: no envía mensajes, correos ni datos de prueba a terceros ni modifica una base de datos del negocio.

Resultado: 125 pruebas de frontend en 36 archivos, repetición final de las nueve pruebas específicas de Contacto, veinte comprobaciones del contrato informativo, dieciocho del contrato de servicios, once recorridos de navegador y compilación de producción aprobados.

Al instalar esta entrega se debe reiniciar el backend para cargar el nuevo rol y la inicialización de Contacto.

Referencias de integración: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) y [exportación e integración de OpenStreetMap](https://wiki.openstreetmap.org/wiki/Export).
