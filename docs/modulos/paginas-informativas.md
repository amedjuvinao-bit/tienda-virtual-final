# Páginas informativas y Nosotros

La primera página es **Nosotros**. El administrador dispone de una plantilla informativa reutilizable para presentar el negocio, información de atención, tarjetas de contenido o preguntas frecuentes. Los textos, imágenes y presentación se administran desde Páginas; no dependen de una categoría comercial concreta.

Nosotros incorpora también la [mesa de recuerdos del diario visual](diario-visual.md), con fotografía protagonista, galería e historias por fecha. El diseño de lectura continúa disponible para las demás páginas informativas y puede seleccionarse desde el editor.

[Contacto](contacto.md) incorpora canales comerciales, horario, ubicación y su composición propia, administrados en el mismo editor por temas.

## Rutas e identidad

- `/nosotros` abre la página con dirección `nosotros`.
- `/nuestra-historia` busca primero una página propia con esa dirección; si no existe, abre Nosotros.
- `/pagina/nosotros` sigue disponible como ruta dinámica.
- Las demás páginas informativas se publican en `/pagina/:slug`.
- El editor está en `/admin/information-page/:id` y requiere `pages:update`.

`ensureAboutPage` crea Nosotros durante la inicialización de páginas únicamente si no existe. Usa inserción atómica sobre el índice único de dirección y recupera una carrera de duplicados. Una página existente conserva tipo, bloques y contenido; no se convierte ni sustituye automáticamente. Las páginas nuevas creadas por esta inicialización reciben el rol interno `about`, cuya dirección y tipo permanecen estables. El rol no se acepta del cuerpo de las operaciones de creación o edición. Las otras páginas informativas admiten nombre y dirección propios.

La selección de destinos del encabezado usa `pagePublicPath`: las páginas fijas enlazan a su ruta pública real. Se excluyen configuraciones de detalle de producto que necesitan un producto concreto, devoluciones que requieren una orden y páginas inactivas. Los enlaces personalizados del negocio se conservan.

## Contenido y apariencia

`informationPageConfig` conserva extensiones desconocidas y se normaliza con el mismo contrato en editor, vista previa y página pública. La información incluye presentación, secciones ordenadas, navegación y una llamada a la acción opcional. Admite texto con saltos de línea, imágenes opcionales a izquierda o derecha, tarjetas y preguntas desplegables. No interpreta HTML. Los enlaces rechazan esquemas ejecutables, direcciones ambiguas y rutas administrativas. Las imágenes solo se cargan desde el equipo mediante el componente administrativo existente y su endpoint de Cloudinary.

Las páginas informativas creadas por el usuario toman su propio nombre como título y empiezan sin secciones. Nosotros contiene textos iniciales generales y editables, sin historia comercial, cifras o datos de contacto inventados. La ausencia de imagen y los fallos de carga recuperan el ancho de lectura; no dejan un panel de fotografía vacío.

La presentación utiliza las variables y superficies compartidas del escaparate, con fondo continuo de Inicio o fondo propio de escritorio/móvil, pie continuo, cristal, colores, grosor, reflejo, tipografía, medidas y visibilidad. La navegación de secciones permanece visible en escritorio y se dispone en filas en móvil, sin una barra interna de desplazamiento. El espacio superior de las secciones prevalece sobre el reinicio global de `section[id]`, incluido el margen de llegada al navegar por anclas.

## Edición y recuperación

El editor agrupa Contenido, Diseño, Opciones y Ajustes. Las secciones se añaden, seleccionan, ordenan, ocultan o eliminan dentro de su tema. La vista previa permanece fija y contiene el borrador antes del guardado. Sus enlaces y formularios no realizan operaciones reales.

Se conservan las guardas del editor compartido: borrador, aviso al salir, aborto de solicitudes, recuperación y comparación de la respuesta guardada con el contenido enviado. La página informativa valida nombre, dirección, destino del botón y preguntas incompletas antes de enviar. Durante una carga se bloquean guardar, eliminar/reordenar secciones y cambiar de tema para evitar desmontar el campo que realiza la subida. Esta protección adicional es opcional en el espacio de trabajo y solo está activada aquí.

La carga pública de páginas dinámicas distingue un recurso inexistente de una caída de conexión. Una caída ofrece reintento con el fondo del escaparate; un 404 o una página inactiva usan Página no encontrada. Las consultas se cancelan al cambiar de dirección y sus respuestas tardías no reemplazan la página actual. La apariencia del cargador se recuerda usando la ruta visitada, incluidos los alias de Nosotros.

## Verificación

Las pruebas de frontend cubren normalización, extensiones, acciones inseguras, texto sin ejecución de HTML, imágenes rotas, preguntas frecuentes, borrador, subida, identidad, permisos y cancelación de solicitudes. Los contratos de backend verifican creación, guardado, omisión de configuración sin pérdida, identidad protegida, alias, carreras de inicialización y conservación de páginas anteriores. La compilación de producción también se verifica.

La auditoría de navegador utiliza App, encabezado, pie, editor e iframe reales con API controlada. Recorre Inicio → Nosotros, el enlace del pie Nuestra historia, acceso directo/recarga, 320–1536 px, navegación fija, fondo continuo, fallo de conexión/reintento, desactivación, subida de archivo del equipo, guardado y recarga, grosor/reflejo cero, fondo propio del alias y creación de otra página con preguntas frecuentes. No escribe en la base de datos del negocio ni carga archivos reales a Cloudinary.

## Alcance de esta entrega

Se entrega la base reutilizable, Nosotros y Contacto, junto con sus enlaces compatibles. Nuestra sede utiliza Contacto cuando no existe una página propia. Envíos, políticas, privacidad y términos podrán usar esta base con el contenido aprobado por el negocio. El portal de devoluciones por orden conserva su función y autorización independientes.

Resultado: 107 pruebas de frontend en 28 archivos, contratos de backend de servicios (18) e información (14), diez recorridos de navegador y compilación de producción aprobados. Una comprobación final dirigida repite las 17 pruebas de creación, edición, normalización, cancelación e identidad después de los últimos ajustes.
