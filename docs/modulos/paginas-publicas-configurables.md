# Inventario de páginas públicas y configuración

Todas las rutas públicas registradas en `App.jsx` tienen una ubicación de configuración. Las páginas del panel son herramientas administrativas; su apariencia general se controla en Configuración → Panel de administración y los accesos en Configuración → Acceso administrativo.

| Ruta pública | Configuración |
| --- | --- |
| `/` y `/lo-nuevo` (redirección a una sección de Inicio) | Apariencia: secciones, fondo, encabezado, pie y animaciones |
| `/pagina/:slug` | Páginas: editor de bloques o catálogo según el tipo |
| `/producto/:id` y `/p/:id` | Páginas: Detalle de producto |
| `/carrito` | Páginas: Carrito |
| `/favoritos` | Páginas: Favoritos |
| `/buscar` | Páginas: Búsqueda |
| `/checkout` | Páginas: Finalizar compra |
| `/gracias` | Páginas: Confirmación de compra |
| `/devoluciones/:orderId` | Páginas: Cambios y devoluciones |
| Rutas inexistentes | Páginas: Página no encontrada |
| `/probe-site-settings` | Diagnóstico de desarrollo, excluido en producción |

El listado de Páginas incluye un acceso a Apariencia. El portal de devoluciones muestra su ruta como patrón, sin ofrecer un enlace público con un ID inventado: se abre desde el enlace seguro de una compra o desde la vista previa del editor.

## Búsqueda y cambios/devoluciones

Ambas páginas se registran automáticamente en la colección `pages`, con tipos `search-page` y `returns-page`, y configuraciones `searchPageConfig` y `returnsPageConfig`. Se incluyen en listado, lectura por slug/ID y guardado validado. Sus identidades son fijas y no admiten duplicación, conversión desde otra página ni eliminación. Se conservan las configuraciones existentes y extensiones; las nuevas páginas se crean mediante upsert atómico por slug.

Los editores comparten `SystemPageEditor`, borrador, aviso de cambios sin guardar, bloqueo durante cargas, comprobación de que el servidor conservó todos los ajustes y vista previa aislada en iframe. Los permisos son `pages:update`; pertenecen a Páginas en la navegación.

Las pestañas agrupan presentación, textos y acciones, mensajes y etiquetas, fondo/cristal, colores, medidas/formas y visibilidad. El título admite texto o imagen subida desde el PC mediante el componente de Cloudinary existente. Los fondos propios admiten imágenes distintas de escritorio y móvil. La opción predeterminada hereda el fondo continuo de Inicio, incluido el pie; las pantallas de carga usan el mismo sistema. El caché de carga agrupa las devoluciones por tipo de página y no guarda IDs de órdenes como claves de apariencia.

El material reutiliza `CartMaterial` y `PolishedGlassRim`. Paneles, campos y botones tienen tintes, bordes y texto configurables, y los botones responden a hover, pulsación y foco con respeto a movimiento reducido. El editor de búsqueda configura columnas de escritorio/móvil, ajuste y proporción de las fotos; reutiliza las tarjetas editoriales del catálogo.

La vista previa muestra contenido ficticio o estados vacíos. No crea ni cancela devoluciones ni descarga etiquetas; las acciones de compra usan los proveedores demostrativos del iframe.

## Separación de presentación y operaciones

El contenido de la política, los plazos, las soluciones permitidas, cantidades disponibles, autorizaciones y estados proceden del módulo de devoluciones. La política se administra en Pedidos → Devoluciones → Política. El editor incluye una explicación y acceso al módulo. Personalizar títulos, etiquetas o colores nunca cambia la elegibilidad de un producto ni concede acceso a una orden.

El portal conserva el token limitado a la orden y la clave de idempotencia de creación. Al cambiar de orden, limpia el borrador y descarta consultas anteriores; no reutiliza el acceso de otra compra. Las consultas cancelan peticiones anteriores; las mutaciones de creación se bloquean sincrónicamente y se cancelan al abandonar la orden. Un error de red permite reintentar sin generar otra clave mientras no cambie el contenido de la solicitud.

Búsqueda conserva la paginación del servidor, filtros de categoría, límites de consulta y reintentos. Una respuesta anterior cancelada no sustituye los resultados de la consulta actual. Se eliminó el nombre comercial fijo de la cabecera.

## Verificación

- `npm run test:service-pages` en frontend: normalización, controles, persistencia del editor, configuración pública, acceso al portal y paginación.
- `npm run test:service-pages` en backend: contrato HTTP con modelo controlado; registro, guardado, lectura, protección de identidad y validación de esquema. No requiere ni modifica MongoDB real.
- `publicPageCoverage.test.js` obliga a asignar una ubicación de configuración al agregar otra ruta pública en `App.jsx`.
- Comprobación de navegador de rutas públicas y editores con API controlada: sin desbordamiento a 320–1440 px, continuidad móvil y pie, material, formulario con token e idempotencia, vista previa sin operaciones, carga de imagen, guardado/recarga y columnas configurables.

Las verificaciones usan datos controlados. No sustituyen una prueba con las políticas, órdenes y credenciales de Cloudinary del entorno del comercio.

Resultado de esta entrega: 53 archivos / 226 pruebas de frontend, compilación de producción, 18 comprobaciones del contrato de páginas del backend, 12 de fronteras de Órdenes y 14 de idempotencia RMA aprobadas. Nueve recorridos de navegador con API controlada aprobados.
