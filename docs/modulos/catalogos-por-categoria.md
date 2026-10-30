# Catálogos por categoría: Bautizos

La página `/categoria/bautizos` reutiliza `DynamicPage`, `CatalogPageView`, las tarjetas, los filtros, el carrito, los favoritos y el editor de catálogo existentes. No incorpora un segundo motor de catálogo ni modifica las reglas de compra o inventario.

## Configuración inicial

Al solicitar las páginas, el servidor crea Bautizos si todavía no existe. Toma como base la configuración guardada de Complementos, incluidos colores, cristal, tarjetas, filtros, columnas, animaciones e ilustración. Si no hay una configuración de origen válida, usa los valores iniciales del catálogo. El encabezado y pie permanecen conectados a los ajustes de la tienda.

La copia inicial adapta el título, descripción, buscador y mensajes a la nueva selección, establece el origen en categorías y selecciona **Bautizos**. Vacía cualquier selección manual o filtro inicial heredado para impedir que entren los productos de Complementos. Las categorías permitidas siguen siendo editables.

Después de la creación, cada página conserva su propia configuración. Los cambios posteriores de Complementos no sobrescriben Bautizos, ni se modifican páginas que ya existan con esos slugs. No se crean productos, categorías de inventario ni existencias de ejemplo.

## Uso del panel

1. Actualizar el proyecto y reiniciar el backend para que cargue la definición nueva.
2. Abrir **Páginas → Bautizos**. El editor es el mismo de Complementos, con sus temas y vista previa. En **Productos → Categorías**, comprobar las categorías permitidas.
3. Crear la categoría de productos Bautizos si todavía no existe, cargar los productos reales, asociarlos a ella y publicarlos. Al abrir o actualizar la página aparecerán los productos correspondientes; sin productos se muestra el estado vacío.
4. En **Apariencia → Categorías → Contenido → Nombre y enlace**, seleccionar la tarjeta Bautizos y elegir **Bautizos** en **Página del catálogo**. Guardar la apariencia. El campo actual de enlace se actualiza a `/categoria/bautizos` sin escribir rutas.

El selector también ofrece Complementos. Los enlaces personalizados existentes se conservan hasta que el administrador elija otro destino. No se deduce ni se cambia un enlace guardado a partir del nombre o la fotografía de una tarjeta.

## Organización

`shared/catalogPages.json` declara las identidades, rutas públicas y categorías iniciales de estos catálogos. Lo comparten el servidor, las rutas públicas, la identificación de páginas en el panel y el selector de destinos de Apariencia. El slug de cada página está protegido por las reglas existentes de los catálogos del sistema; el nombre visible, textos y presentación son editables.

La ilustración inicial se reutiliza del catálogo de origen y puede sustituirse mediante carga desde el equipo o desactivarse. No se han generado ni añadido imágenes de inventario. La referencia de diseño y la procedencia del recurso decorativo utilizado por Complementos están documentadas en `complementos-catalogo.md`.

Los filtros son los que ya admite el catálogo existente. La consulta conserva `categoryScope=Bautizos` independientemente de los filtros del visitante y respeta la publicación, visibilidad y archivo del producto.

## Verificación

- 115 pruebas de interfaz: catálogo, tarjetas, consultas, editor, rutas, administración y sección de categorías. Incluyen la ruta y selección exclusiva de Bautizos y la elección de un destino desde Apariencia sin modificar las otras tarjetas.
- Ocho grupos de contrato de catálogos: creación única, acceso, herencia de la configuración guardada, selección independiente, edición, conservación de extensiones y protecciones de dirección, tipo y eliminación.
- 24 comprobaciones de regresión de páginas informativas.
- Compilación de producción de Vite y revisión de diferencias sin errores.
- Tres comprobaciones HTTP de Vite en desarrollo: el registro compartido se carga desde las rutas públicas, el editor y el selector de Apariencia.

Las pruebas usan modelos y respuestas controlados. No se accedió a la configuración ni a los productos de la instalación local del usuario; por eso el enlace guardado de su tarjeta se conserva y se elige desde el selector indicado.
