# Catálogo de Complementos

La ruta pública `/complementos` muestra una selección administrable conectada al catálogo real. Conserva el encabezado y pie configurados, el fondo continuo de Inicio y el material de cristal de los catálogos existentes. `/pagina/complementos` sigue siendo compatible.

## Preparar los productos

1. En **Productos / Categorías**, crear la categoría **Complementos**, si aún no existe. También se puede usar otra categoría y seleccionarla en el paso siguiente.
2. En **Páginas → Complementos → Productos**, mantener **Solo categorías permitidas** como origen y elegir las categorías en **Categorías → Categorías permitidas**. El valor inicial es `Complementos`.
3. Cargar las fotos y completar los productos reales, asociarlos a las categorías seleccionadas y publicarlos. La consulta pública respeta los estados activo, visible y sin archivar.
4. Al volver a abrir o actualizar `/complementos`, los productos correspondientes aparecen automáticamente. No hace falta editar esta página por cada producto ni crear tarjetas a mano.

No se crean productos, categorías, existencias ni pedidos de ejemplo. Antes de publicar productos se muestra un estado vacío propio. Una búsqueda sin coincidencias tiene un mensaje distinto. Si la selección de categorías está vacía, no se sustituye por todos los productos de la tienda.

## Edición y presentación

- **Contenido / Productos**: origen, categorías permitidas, filtros iniciales o selección manual.
- **Diseño / Ilustración y mensajes**: ilustración opcional, carga desde el equipo mediante el campo Cloudinary existente, descripción, ancho, ayuda del buscador, título de categorías y mensajes de búsqueda o foto ausente.
- **Diseño / Encabezado, Fondo y cristal, Tarjetas de producto, Filtros, Distribución y Animaciones**: controles existentes de colores, bordes, material, textos, fotos, columnas y movimiento.
- **Opciones / Sin resultados**: título y explicación inicial cuando todavía no hay artículos.
- **Ajustes / Datos de la página**: nombre y ajustes generales. La dirección del catálogo está protegida para conservar sus enlaces.

La vista previa usa la ruta propia, conserva la posición fija del editor y aplica el borrador antes de guardar. El guardado y la navegación entre temas se bloquean durante una carga de imagen. Los ajustes desconocidos dentro de la configuración de la selección se conservan al guardar.

El encabezado integra búsqueda, orden, cantidad de resultados, filtros y vistas. En escritorio los filtros acompañan a la cuadrícula y en móvil usan el diálogo existente. Las fotografías ocupan el área completa de la tarjeta; los botones de favorito y carrito conservan las animaciones, selección y reglas reales. Si el producto requiere elegir opciones, el carrito dirige al detalle; si permite compra directa utiliza el flujo existente. Una foto ausente o que falla muestra un aviso configurable sin eliminar el producto.

Los filtros habilitados son los que admite el catálogo real: categorías, colores, precio, búsqueda y orden. No se incorpora una casilla decorativa de disponibilidad; la disponibilidad de cada artículo continúa bajo las reglas existentes de inventario y compra.

## Organización técnica

- `backend/services/pages/catalogPages.js`: definición y creación idempotente de la página mediante `$setOnInsert`. No sobrescribe páginas guardadas ni crea inventario. Si ya existe el slug, conserva esa página y su configuración.
- `backend/routes/pages.js`: incluye la página en la carga de páginas y protege su dirección, tipo y eliminación. No reserva todos los catálogos, solo las direcciones declaradas.
- `frontend/src/components/catalog/CollectionCatalogIntro.jsx`, `collectionCatalogConfig.js` y `collectionCatalog.css`: presentación opcional, normalización y estilos de selección, activados por `catalogConfig.collection`. Los catálogos anteriores siguen su presentación existente.
- `frontend/src/admin/pages/workspace/CollectionCatalogControls.jsx`: controles agrupados del nuevo encabezado y mensajes. El editor reutiliza el buscador, productos, categorías, filtros, carga de imágenes y vista previa existentes.
- El ámbito `categoryScope` y los filtros de categorías del visitante se combinan por intersección en el servidor; un filtro no amplía la selección a productos ajenos.

## Ilustración y referencia

Referencia aprobada: `/workspace/scratch/8cbd4873f312/generated_images/exec-48cbe26c-dc5b-4d7e-bee2-350c814339f2.png`.

Ilustración generada con fondo alfa transparente: `/workspace/scratch/8cbd4873f312/generated_images/exec-718993a3-77cd-4ebb-9534-56855e9ca8d2.png`. Se convirtió a WebP RGBA, calidad 88, método 6, sin recortar ni redimensionar: `frontend/public/catalog/crystal-complements.webp`, 1663 × 946 px, 380928 bytes. Es decoración, no una fotografía de inventario. Puede sustituirse o desactivarse desde el panel.

Prompt utilizado:

> Use case: background-extraction / product-mockup. Recreate ONLY the small transparent rosy crystal shopping bag illustration from the top right hero of this approved catalogue mockup, isolated on a genuinely transparent alpha background. One clear polished glass shopping bag with curved glass handles and a burgundy satin ribbon bow tied around the right handle, a few delicate blush roses and petals resting at its base. Same proportions, thin refractive edges with small bright local corner glints, clear interior, sophisticated warm rosy light, no opaque white fill, no dark blotch. Landscape isolated arrangement with everything fully contained and clear space around it. No products from the grid, no text, no website, no logo, no rectangular pink or white backdrop, no ground panel. Decorative hero asset for placement over a continuous floral rose background, not a product for sale. Preserve transparency.

## Validación

- Contrato de Complementos: seis grupos sobre creación única, acceso, edición, conservación, protecciones y ámbito real de categorías.
- Contratos de páginas informativas: 24 comprobaciones de regresión.
- Pruebas del catálogo y editor: selección vacía, filtros sin ampliar el ámbito, productos recibidos, foto fallida, preservación de configuración, categorías sin productos y bloqueo durante carga, junto con las pruebas existentes de presentación, carrito, panel y rutas.
- Chromium: 17 controles con API y datos controlados, tamaños 1536, 1024, 768, 390 y 320 px, sin desbordamiento horizontal; favoritos, carrito, detalle, filtro móvil, búsqueda, editor, guardado, vista previa fija y recuperación tras error de carga. Sin productos, pedidos ni cambios en la base de datos real.
- Compilación de producción de Vite y revisión de diferencias.

Las pruebas controladas verifican el código y el flujo. La apariencia final hereda la configuración real de Inicio; no se ha inspeccionado ni modificado la base de datos de la instalación publicada durante este trabajo.
