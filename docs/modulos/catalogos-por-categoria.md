# Catálogos por categoría

Cada categoría reutiliza `DynamicPage`, `CatalogPageView`, las tarjetas, los filtros, el carrito, los favoritos y el editor de catálogo existentes. No incorpora un segundo motor de catálogo ni modifica las reglas de compra o inventario.

| Página | Ruta pública | Selección inicial de productos |
| --- | --- | --- |
| Complementos | `/complementos` | Complementos |
| Bautizos | `/categoria/bautizos` | Bautizos |
| Vestidos | `/categoria/vestidos` | Vestidos |
| Jeans | `/categoria/jeans` | Jeans |
| Calzado | `/categoria/calzado` | Calzado |
| Novedades | `/lo-nuevo` | Todos los publicados, más recientes primero |

## Configuración inicial

Al solicitar las páginas, el servidor crea las selecciones que todavía no existen. Toma como base la configuración guardada de Complementos, incluidos colores, cristal, tarjetas, filtros, columnas y animaciones. Si no hay una configuración de origen válida, usa los valores iniciales del catálogo. El encabezado y pie permanecen conectados a los ajustes de la tienda.

La copia inicial adapta el título, descripción, buscador y mensajes a la nueva selección, establece el origen en categorías y selecciona la categoría indicada en la tabla. Vacía cualquier selección manual o filtro inicial heredado para impedir que entren los productos de Complementos. Las categorías permitidas siguen siendo editables.

Las selecciones nuevas empiezan sin ilustración hasta que el administrador cargue una propia. No heredan la bolsa ni la descripción de la imagen de Complementos. El encabezado utiliza el ancho disponible cuando no hay imagen. Después de la creación, cada página conserva su propia configuración e ilustración. Los cambios posteriores de Complementos no sobrescriben las selecciones, ni se modifican páginas que ya existan con esos slugs. No se crean productos, categorías de inventario ni existencias de ejemplo.

## Uso del panel

1. Actualizar el proyecto y reiniciar el backend para que cargue la definición nueva.
2. Abrir **Páginas** y elegir la categoría correspondiente. El editor es el mismo de Complementos, con sus temas y vista previa. En **Productos → Categorías**, comprobar las categorías permitidas.
3. Crear la categoría de productos si todavía no existe, cargar los productos reales, asociarlos a ella y publicarlos. Al abrir o actualizar su página aparecerán los productos correspondientes; sin productos se muestra el estado vacío.
4. En **Apariencia → Categorías → Contenido → Nombre y enlace**, seleccionar la tarjeta de Inicio y elegir su destino en **Página del catálogo**. Guardar la apariencia. Por ejemplo, elegir **Vestidos** enlaza la tarjeta con `/categoria/vestidos` sin escribir rutas.

El selector ofrece las seis páginas de la tabla. Los enlaces personalizados existentes se conservan hasta que el administrador elija otro destino. No se deduce ni se cambia un enlace guardado a partir del nombre o la fotografía de una tarjeta.

## Novedades

`/lo-nuevo` abre una página de catálogo propia; ya no redirige a la sección de tendencias de Inicio. Se administra desde **Páginas → Novedades** y aparece también en los selectores de destinos de Apariencia.

Su configuración inicial muestra productos activos, visibles y sin archivar, ordenados por `createdAt` descendente, con `_id` descendente como desempate estable del servidor. No impone una antigüedad máxima ni una marca de producto nuevo: presenta el catálogo publicado con las incorporaciones más recientes primero. En **Productos** se puede cambiar a categorías permitidas o selección manual; en **Diseño → Distribución → Herramientas** se cambia el orden inicial.

La creación conserva la presentación del catálogo de referencia, pero limpia las selecciones manuales, categorías y filtros iniciales de color y precio heredados. No utiliza la ilustración de Complementos. La ilustración propia se carga desde **Encabezado → Adorno**. Una página ya guardada con ese slug mantiene su contenido y ajustes; no se sobrescribe en las lecturas.

Las preferencias guardadas de menú que apunten explícitamente a una sección de Inicio se conservan. Para dirigir ese enlace a la página nueva, se elige **Novedades** o **Página · Novedades** en Apariencia y se guarda la configuración.

## Cargar la ilustración del encabezado

Dentro de cada página, en **Diseño → Encabezado → Adorno**, el control **Ilustración del catálogo** permite seleccionar o cambiar una imagen del equipo. Admite PNG con transparencia, JPG o WebP de hasta 8 MB y utiliza el cargador autenticado existente de Cloudinary. Tras la carga, la vista previa muestra la imagen y hay que guardar los cambios para publicarla. También permite ocultar o quitar la ilustración y ajustar su ancho y descripción. Para mantener la línea visual aprobada pueden cargarse ilustraciones de cristal con transparencia relacionadas con cada categoría.

Este apartado edita el mismo ajuste que **Diseño → Ilustración y mensajes** mediante un componente compartido, `CollectionCatalogArtworkControls`. En los catálogos de selección utiliza los campos `catalogConfig.collection` que consume el encabezado público. Los controles del adorno anterior se conservan en los catálogos que sí los utilizan. La carga bloquea el guardado y la navegación del editor hasta terminar; los cambios simultáneos de texto o tamaño se conservan.

Validación del control: 20 pruebas de catálogo, editor, panel de apariencia y carga de imágenes. Incluyen el archivo enviado a `/api/uploads`, la aplicación de la respuesta, cambios durante la carga, el borrador de vista previa, el guardado de Bautizos y la conservación de los controles de los catálogos anteriores. Compilación de producción correcta. Las respuestas de subida se simulan en las pruebas; no se realiza una carga real a la cuenta Cloudinary del usuario.

## Organización

`shared/catalogPages.json` declara las identidades, rutas públicas y categorías iniciales de estos catálogos. Lo comparten el servidor, las rutas públicas, la identificación de páginas en el panel y el selector de destinos de Apariencia. El slug de cada página está protegido por las reglas existentes de los catálogos del sistema; el nombre visible, textos y presentación son editables.

Cada ilustración es independiente y puede cargarse desde el equipo o desactivarse. No se han generado ni añadido imágenes de inventario. La referencia de diseño y la procedencia del recurso decorativo utilizado por Complementos están documentadas en `complementos-catalogo.md`.

Los filtros son los que ya admite el catálogo existente. La consulta conserva el ámbito de categorías de la página, por ejemplo `categoryScope=Vestidos`, independientemente de los filtros del visitante y respeta la publicación, visibilidad y archivo del producto.

## Verificación

- 131 pruebas de interfaz: catálogo, tarjetas, consultas, editor, rutas, administración, carga de imágenes y sección de categorías. Incluyen las rutas y consultas de cada selección, su estado vacío sin ilustraciones ajenas, carga y guardado de la imagen propia y selección del destino desde Apariencia sin modificar las otras tarjetas.
- 11 grupos de contrato de catálogos: creación única, acceso, herencia de la configuración guardada, selección independiente, edición, conservación de extensiones y protecciones de dirección, tipo y eliminación. Comprueban los cinco catálogos y que ningún ámbito de los tres nuevos acepte los nombres de las otras categorías.
- 24 comprobaciones de regresión de páginas informativas.
- Compilación de producción de Vite y revisión de diferencias sin errores.
- Tres comprobaciones HTTP de Vite en desarrollo: el registro compartido se carga desde las rutas públicas, el editor y el selector de Apariencia.

Validación de Novedades: 164 pruebas de interfaz, 12 grupos de contrato de catálogos, 24 comprobaciones de páginas informativas, 16 comprobaciones de paginación pública y compilación de producción. Incluye consulta inicial sin ámbito de otra categoría, orden por fecha, edición y guardado de una selección distinta, ilustración propia y enlace desde Apariencia. Los resultados de la revisión de enlaces se documentan en `auditoria-enlaces-publicos.md`.

Las pruebas usan modelos y respuestas controlados. No se accedió a la configuración ni a los productos de la instalación local del usuario; por eso el enlace guardado de su tarjeta se conserva y se elige desde el selector indicado.
