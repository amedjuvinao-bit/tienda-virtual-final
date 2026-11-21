# Diario visual: mesa de recuerdos

La página Nosotros incorpora la composición aprobada: fotografía protagonista, recuerdos de distintos tamaños alrededor, contornos de cristal, relato seleccionado y navegación temporal. La mesa permite descubrir la parte humana del negocio con contenido propio, sin convertirla en un catálogo de productos.

## Configuración y adopción

El diseño se guarda como `informationPageConfig.layout: "memory-table"`; `journal` contiene recuerdos, textos y opciones de presentación. Las páginas informativas genéricas conservan el diseño de lectura. Nosotros adopta la mesa cuando aún no tiene una selección explícita de diseño. Se conservan los colores, fondos, imágenes, extensiones y secciones anteriores. Los títulos y tamaños predeterminados anteriores se ajustan a la composición aprobada; los personalizados se conservan.

Las secciones anteriores que contienen una imagen pueden convertirse inicialmente en recuerdos con su título, descripción e imagen originales. No se generan fechas para ellas. Después de guardar una lista explícita de recuerdos, esta lista es la fuente del diario. Las secciones originales permanecen editables y pueden mostrarse debajo con su opción correspondiente.

Cada recuerdo incluye identificador estable, título, descripción breve, historia, fecha opcional, categoría, foto principal, encuadre, visibilidad y hasta ocho fotos adicionales con descripción y pie de foto. Se conservan extensiones desconocidas. La fecha se valida como fecha real de calendario y se presenta sin desplazamientos por la zona horaria del visitante. La ordenación es cronológica estable; los recuerdos sin fecha quedan después de los fechados. Las categorías se derivan del contenido visible.

Hay un máximo de sesenta recuerdos por página en esta versión del contrato CMS. La mesa dibuja siete alrededor del seleccionado; la barra temporal muestra una ventana de hasta nueve miniaturas en escritorio o cinco en móvil. La lista alternativa carga las imágenes de forma diferida. Las fotos originales y sus galerías se sirven desde los enlaces devueltos por Cloudinary.

## Interacción pública

- Seleccionar una foto lateral la convierte en protagonista; su botón abre el relato completo.
- Los filtros limitan el recorrido a una categoría; la línea de tiempo y sus flechas cambian el recuerdo seleccionado.
- Inicio, Fin y flechas del teclado recorren la línea temporal con conservación del foco.
- Acercar y Alejar modifican la escala de la mesa de escritorio. La vista en lista ofrece otra forma de explorarla.
- Abrir un recuerdo añade `?momento=<id>` y conserva los demás parámetros. La dirección puede recargarse o compartirse; los botones de atrás y adelante abren o cierran el detalle correspondiente.
- El detalle muestra la foto completa sin recorte, galería y relato. Captura el foco, permite Escape y devuelve el foco al control que lo abrió. Su cierre recupera el desplazamiento anterior.
- Los recuerdos ocultos, incompletos o sin foto principal no aparecen en la mesa ni se abren mediante parámetros de URL.

Los relatos se muestran como texto; no se interpreta HTML. En móvil las imágenes pasan a una composición de lectura con la fotografía protagonista y el resto en dos columnas. No se añade una barra vertical interna al contenido de la página.

## Material y movimiento

`MemoryPhoto`, `MemoryTimeline`, `MemoryDialog`, `MemoryImage` y `MemoryTable` separan las responsabilidades de presentación. Las variables de cristal, colores y botones proceden del contrato compartido del escaparate. El fondo y el pie mantienen la continuidad configurada de Inicio o el fondo propio seleccionado. El brillo de los marcos se vincula explícitamente al color elegido en el editor, sin heredar otra paleta de sección. Radio, profundidad, ancho y reflejo aceptan cero.

`useMemoryMotion` anima los cambios de posición con transformaciones nativas. No anima ancho y alto continuamente, lo que evita reconstruir el relieve del marco en cada fotograma. La geometría de cada marco se mide en su tamaño final. Las animaciones se cancelan al cambiar de selección o salir; se respeta movimiento reducido. Los textos largos recuperan espacio vertical para permanecer separados de las fotografías.

## Administración

La página se edita en **Páginas → Nosotros**:

- **Título y presentación:** diseño de lectura o mesa, título e introducción.
- **Recuerdos y fotografías:** selección del recuerdo, título, fecha, categoría, foto, encuadre, historia, galería, visibilidad y recuerdo destacado.
- **Textos del diario:** etiquetas públicas y estado sin recuerdos.
- **Mesa y fotografías:** tamaño, radio, profundidad, tipografía, animación y controles visibles.
- **Fondo y cristal / Colores:** material, bordes, fondos y paleta del escaparate.

Las cargas de imágenes utilizan `AdminImageUploadField`: selección de archivos JPG, PNG o WebP del equipo y carga por el endpoint administrativo existente. Durante la subida se bloquean guardar, cambiar de tema o recuerdo y eliminar el contenido asociado. Un recuerdo visible necesita título y foto para guardarse; puede ocultarse mientras se prepara.

El borrador y su vista previa permanecen separados del estado publicado. Se conserva el guardado verificado del editor: si el servidor omite ajustes, el borrador permanece pendiente y muestra el error. El CMS existente ya admite la estructura anidada; no necesita una nueva colección ni otro endpoint.

## Fotografías de muestra

La vista previa usa ejemplos únicamente cuando el diario todavía no tiene recuerdos completos. Se identifican como fotografías, fechas y relatos ilustrativos; no se añaden al borrador ni al guardado. La página pública usa los recuerdos del negocio y presenta un mensaje configurable cuando todavía no hay contenido.

El recurso `frontend/public/diary/preview-atlas.webp` contiene seis fotografías ficticias generadas con la herramienta integrada de imágenes. Se codificó para uso web y se utiliza como atlas solo en la demostración del editor. `MemoryImage` recorta cada celda con un `viewBox` SVG, sin duplicar seis archivos ni alterar las fotografías cargadas por el usuario. Las páginas públicas y sus recuerdos reales no utilizan ese recorte ilustrativo.

Especificación del recurso: cuadrícula 3×2 sin separaciones, seis escenas cotidianas de adultos ficticios en un negocio, luz natural cálida, sin marcas ni texto; conversación de bienvenida, equipo, trabajo diario, apertura del espacio y celebración. Recurso generado mediante la herramienta integrada, no mediante una API externa configurada por el usuario.

## Verificación

Pruebas de frontend: normalización y conservación, adopción selectiva, fechas reales, orden, filtros, ventana de recuerdos, historias, galería, enlaces directos, elementos ocultos, aislamiento de ejemplos, edición y validación previa al envío. Se mantienen las pruebas del espacio de trabajo, permisos, páginas informativas y material compartido.

Los contratos de backend comprueban la persistencia completa de `journal`, fotos, galería y extensiones a través del controlador de páginas. La comprobación de navegador usa App, encabezado, editor e iframe reales con respuestas controladas, incluido el flujo de selección de archivo y guardado. No modifica la base de datos del negocio ni sube fotografías reales a Cloudinary.
