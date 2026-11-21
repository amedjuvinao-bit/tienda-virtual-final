# Centro de ayuda y preguntas frecuentes

La página incorpora la composición aprobada: título editorial, buscador de cristal, temas laterales, respuestas desplegables y atención conectada con Contacto. Hereda el fondo continuo de Inicio y el pie configurado. En escritorio los temas permanecen visibles al bajar; en móvil se distribuyen en filas sin desplazamiento interno.

## Contenido comercial inicial

Se entregan catorce respuestas completas en cuatro temas. El contenido describe los recorridos que existen en el proyecto y está listo para mostrarse públicamente. Los administradores pueden personalizarlo, ordenarlo, ocultarlo o sustituirlo.

| Tema | Contenido publicado | Recorrido comprobado |
| --- | --- | --- |
| Pedidos | Compra, consulta de estado, modificación y favoritos | Ficha del producto → carrito → finalización; atención por número de pedido; favoritos públicos |
| Pagos | Medios disponibles, resultado pendiente, rechazo o error | Opciones vigentes en Checkout y resultado de pago verificado; consulta al equipo con referencia |
| Envíos | Costo, ubicación de entrega, retiro y seguimiento | Dirección y opciones de entrega durante la compra; ubicación y horario en Contacto; guía cuando esté disponible |
| Cambios | Solicitud, producto con una novedad y coordinación de revisión | Acceso por compra a cambios/devoluciones cuando esté habilitado; instrucciones del caso y atención por número de pedido |

Las respuestas no prometen tarifas, cobertura universal, días de entrega, periodos de devolución, tiempos de respuesta, reembolsos inmediatos ni medios de pago fijos. Las condiciones variables se consultan en el proceso de compra o en el caso correspondiente. La ayuda no sustituye la política comercial ni concede acceso a una orden. No crea una cuenta de cliente, historial de compras o seguimiento público que no exista en la aplicación.

Los botones iniciales utilizan destinos existentes: categorías de Inicio, Carrito, Favoritos y Contacto. La gestión de una devolución se explica desde la confirmación de su compra, sin inventar identificadores de órdenes ni enlaces de acceso. El texto evita vocabulario limitado a moda y sirve para el catálogo general del negocio.

`helpStarter.js` contiene esta redacción inicial. Se normaliza únicamente al adoptar el diseño Centro de ayuda sin una lista explícita de temas. Una lista guardada, incluso vacía, prevalece. El guardado conserva el contenido y las extensiones del negocio; no vuelve a introducir respuestas eliminadas.

## Rutas e identidad

La dirección principal es `/preguntas-frecuentes`. `/ayuda` y `/centro-ayuda` abren primero una página propia con esa dirección y, cuando no existe, resuelven el Centro de ayuda. También funciona `/pagina/preguntas-frecuentes`.

El backend crea la página informativa con rol interno `help` mediante inserción atómica solo si la dirección no existe. Las páginas anteriores no cambian de tipo, bloques o autoría. La identidad de las páginas informativas del sistema utiliza un mapa de roles y direcciones; se mantienen las protecciones de Nosotros y Contacto. El cuerpo de una solicitud no puede asignar un rol interno ni convertir otra página en el Centro de ayuda. Su dirección y tipo se conservan y no puede eliminarse como una página personalizada.

El selector de destinos del encabezado y Páginas resuelve el destino real. El pie clásico ya apunta a Preguntas frecuentes; el pie editorial incluye Centro de ayuda entre sus destinos predeterminados. Los enlaces personalizados del negocio se conservan.

## Búsqueda e interacción

La búsqueda consulta los títulos de temas y las preguntas y respuestas completas y visibles. No distingue mayúsculas ni acentos; admite varias palabras. Los temas o preguntas ocultos e incompletos no participan en la interfaz pública ni se abren con un parámetro. Los textos y sus respuestas se presentan como texto, sin interpretar HTML.

La URL conserva `tema`, `q` y `pregunta`, además de parámetros ajenos. Se pueden recargar enlaces a una respuesta y usar Atrás y Adelante. Cada respuesta permite expandir o cerrar su contenido con ratón o teclado. La búsqueda reemplaza la entrada actual para no añadir una entrada de historial por cada letra. Las acciones mantienen la posición de la página.

`useHelpNavigation` mantiene el texto inmediato del buscador separado de la transición del router. Las actualizaciones propias de la dirección no sobrescriben letras nuevas mientras llegan transiciones anteriores; la navegación externa y Atrás/Adelante sí recuperan su consulta. La reproducción de escritura rápida comprueba que la consulta se conserva completa. Limpiar y Escape recuperan el foco del campo.

El estado sin coincidencias permite limpiar la búsqueda. El estado sin temas conserva el acceso configurado al equipo. Los enlaces se validan como destinos públicos seguros; no admiten rutas administrativas ni esquemas ejecutables. Las acciones de la vista previa no navegan fuera del iframe ni escriben en el servidor.

## Administración y organización

Páginas → Centro de ayuda agrupa título y presentación, temas y categorías, preguntas y respuestas, buscador y mensajes, atención y enlaces, diseño, fondo/cristal, colores, medidas, visibilidad e identidad. Cada edición de una pregunta se limita a su tema y su selector; no se despliegan todos los formularios a la vez.

Se permiten doce temas y treinta preguntas por tema. Se pueden editar nombres, iconos, títulos, preguntas, respuestas, visibilidad y acciones opcionales, así como su orden. Las preguntas nuevas empiezan ocultas. Una pregunta publicada necesita pregunta y respuesta; un botón opcional necesita texto y destino. La validación conserva el borrador cuando falta información. Los temas vacíos se conservan en el editor y no aparecen en la navegación pública.

El editor conserva las protecciones compartidas de borrador, guardado, salida y carga de imágenes. Los títulos y fondos siguen usando archivos del equipo y Cloudinary. El buscador y la franja de atención tienen sus textos editables. Los colores, ancho de navegación, tipografía, radio, grosor, reflejo, transparencia, desenfoque y profundidad utilizan los controles del módulo informativo, conservando los valores cero.

`HelpPageContent`, `HelpQuestions`, `HelpIcons`, `useHelpNavigation`, `helpPageConfig` y `helpStarter` separan composición, respuestas, iconos, navegación, contrato y contenido inicial. Los editores de temas, preguntas y presentación también están separados. Se reutiliza el material vectorial del módulo informativo que utiliza Contacto; el relieve sigue el contorno real y no añade una placa blanca. La respuesta se anima sin transiciones continuas de ancho o alto y se respeta movimiento reducido.

## Verificación e instalación

Las pruebas cubren el contenido inicial, su adopción selectiva y conservación, extensiones, identidades únicas, temas y respuestas ocultos, búsquedas, enlaces, estado vacío, validación, edición y guardado. La regresión de escritura simula transiciones del router que llegan después de las pulsaciones, e incluye limpiar y navegación externa. Los contratos del backend incluyen persistencia completa, identidad protegida, duplicados, direcciones reservadas, alias y páginas anteriores.

La revisión del navegador usa App, encabezado, pie, editor e iframe reales con API controlada. Comprueba búsquedas, teclado, preguntas directas, recarga, Atrás/Adelante, enlaces, 320–1536 px, fondo continuo, navegación lateral fija, borrador, guardado y recarga, validación de nuevas respuestas, orden, material editable, valores cero y estado sin contenido. No modifica la base de datos del negocio ni envía mensajes o pagos reales.

Resultado: 136 pruebas de frontend en 39 archivos, veinticuatro comprobaciones del contrato informativo, dieciocho del contrato de servicios, doce recorridos de navegador, reproducción de escritura rápida y compilación de producción aprobados.

Al instalar los cambios se debe reiniciar el backend para cargar el rol y crear el Centro de ayuda automáticamente.
