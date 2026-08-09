# Cierre técnico del módulo de Productos

## Estado del módulo

- **Estado:** cerrado y aprobado técnicamente
- **Fecha de cierre:** 29 de julio de 2026
- **Rama:** `feature/productos-comercial-avanzado`
- **Base de la rama:** `main` en `ff33d9f`
- **Commit técnico final validado:** `609b7937e408891c43fbbeac74bc8690cd813cf6`
- **GitHub Actions:** ejecución `30469531006`, resultado `success`

Este documento deja constancia del cierre técnico del módulo avanzado de
Productos. La privacidad pública, la integridad del catálogo, la operación
administrativa, la clasificación comercial, el SEO y el cumplimiento de
productos físicos, digitales, servicios y combos fueron implementados y
validados.

## Alcance cerrado

### 1. Seguridad y privacidad pública

- Las consultas públicas solo entregan productos activos, visibles y no
  archivados.
- La API pública excluye costos, proveedor, notas internas, datos tributarios,
  ubicación de bodega y campos privados de las variantes.
- Los archivos digitales, mensajes internos, enlaces de agenda e instrucciones
  internas no forman parte de la ficha pública.
- El detalle administrativo permanece protegido y conserva la información
  completa necesaria para la gestión.
- Las operaciones administrativas se controlan con permisos específicos de
  lectura, creación, edición, retiro y moderación de reseñas.

### 2. Integridad del guardado, variantes y retiro

- La ficha y sus variantes se guardan en una sola operación.
- Los campos opcionales se pueden limpiar al dejarlos vacíos.
- Se rechazan códigos comerciales y combinaciones de variante duplicados.
- Las variantes inactivas dejan de estar disponibles para venta.
- El inventario avanzado usa `variantKey` como identidad estable.
- El retiro del producto es lógico: conserva producto, imágenes, inventario e
  historial.
- Cuando MongoDB admite transacciones, el producto y su inventario se archivan
  dentro de la misma transacción.
- En instalaciones MongoDB sin transacciones existe compensación para restaurar
  el producto si falla la desactivación del inventario.

### 3. Catálogo escalable y operaciones masivas

- Búsqueda, filtros, ordenamiento, paginación, conteos y resúmenes se ejecutan en
  MongoDB.
- La interfaz recibe únicamente la página solicitada.
- Los filtros distinguen productos con stock, sin stock y bajo stock.
- Los servicios y productos digitales quedan fuera de los indicadores de
  inventario propio.
- La selección múltiple permite publicar, ocultar, activar, desactivar y retirar
  productos con el permiso correspondiente.
- El retiro masivo conserva los documentos y desactiva las existencias
  operativas.

### 4. Categorías, colecciones, SEO y campos comerciales

- Catálogo jerárquico de categorías y subcategorías.
- Colecciones independientes de la jerarquía.
- Etiquetas comerciales normalizadas.
- Compatibilidad con las categorías de texto de productos anteriores.
- Protección contra ciclos en la jerarquía.
- Bloqueo del retiro de una clasificación todavía utilizada.
- Título SEO, metadescripción, canonical, Open Graph e información estructurada.
- Campos comerciales extensibles con control de visibilidad pública o interna.
- Filtros administrativos por categoría, colección y etiqueta.

### 5. Productos físicos, digitales, servicios y combos

| Tipo | Comportamiento cerrado |
|---|---|
| Físico | Controla inventario por sede y variante, reserva existencias y calcula envío. |
| Digital | No controla inventario propio, no cobra envío y genera acceso firmado después del pago. |
| Servicio | No controla inventario propio, no cobra envío y conserva modalidad, ubicación, duración, anticipación y estado de prestación. |
| Combo | Valida componentes y variantes, calcula capacidad por el componente limitante y descuenta únicamente los componentes físicos. |

El flujo funciona en checkout web y punto de venta. Las compras mixtas conservan
el envío únicamente cuando contienen componentes físicos.

Después de confirmar el pago:

- se prepara el cumplimiento una sola vez;
- se generan las entregas digitales;
- se registran los servicios pendientes;
- se envía una sola notificación;
- se evita duplicar entregas o correos al reprocesar el mismo pago;
- las descargas validan token, vigencia y límite de usos;
- los tokens se comparan en tiempo constante;
- la ruta de descarga responde sin caché y sin enviar referencias al navegar.

Desde el detalle administrativo de la orden, cada servicio puede pasar por
`pending`, `scheduled`, `in_progress`, `completed` o `cancelled`, conservando
fecha y trazabilidad.

## Arquitectura principal

| Responsabilidad | Componentes principales |
|---|---|
| Modelo comercial | `backend/models/Product.js` |
| Taxonomía | `backend/models/ProductTaxonomy.js`, `backend/services/productTaxonomyService.js` |
| Vista pública segura | `backend/lib/products/productPublicView.js` |
| Listado y operaciones masivas | `backend/services/adminProductCatalogService.js` |
| Retiro lógico | `backend/services/productArchiveService.js` |
| Variantes e inventario | `backend/services/productInventorySyncService.js` |
| Combos | `backend/services/productBundleService.js` |
| Cumplimiento posterior al pago | `backend/services/orderFulfillmentService.js` |
| Precios y envío | `backend/services/orderPricingService.js` |
| Reserva de inventario | `backend/services/inventoryReservationService.js` |
| Descargas protegidas | `backend/routes/digitalDeliveries.js` |
| API de productos | `backend/routes/productRoutes.js` |
| Formulario administrativo | `frontend/src/admin/FormularioProducto.jsx` |
| Catálogo administrativo | `frontend/src/admin/ProductosAdmin.jsx` |
| Ficha pública y SEO | `frontend/src/components/product-detail/ProductDetailView.jsx`, `frontend/src/lib/productSeo.js` |
| Seguimiento de la orden | `frontend/src/admin/orders/components/orderDetail/OrderDetailFulfillmentPanel.jsx` |

## Seguridad administrativa

Los permisos canónicos utilizados por Productos son:

- `products:view`;
- `products:create`;
- `products:update`;
- `products:delete`;
- `products:reviews`;
- `products:export`.

Las rutas de listado, detalle, taxonomía, actualización masiva y retiro masivo
están incluidas en el mapa global de permisos. Las operaciones de modificación y
retiro se marcan para auditoría; el retiro se clasifica como operación sensible.

## Escalabilidad

El cierre comprobó:

- paginación y filtros ejecutados antes de devolver datos al navegador;
- resúmenes globales independientes de la página actual;
- consulta de inventario por agregación;
- operaciones masivas limitadas a identificadores validados;
- retiro de productos procesado de forma segura por registro;
- pruebas con 37 productos temporales;
- compatibilidad con productos y categorías heredados;
- separación entre inventario físico y cumplimiento virtual.

## Validación final

### GitHub Actions

El flujo `Productos CI` se ejecuta al publicar en la rama de Productos, al abrir
un pull request hacia `main` y al publicar en `main`. También puede ejecutarse
manualmente.

Resultado del commit técnico `609b793`:

| Trabajo | Resultado |
|---|---:|
| Seguridad de dependencias | Aprobado |
| Integridad de productos | Aprobado |
| Productos e inventario con MongoDB 7 | Aprobado |
| Interfaz de productos | Aprobado |
| Total GitHub Actions | 4/4 |

### Controles funcionales

| Suite | Resultado |
|---|---:|
| Integridad del producto | 16/16 |
| Privacidad pública | 10/10 |
| Catálogo y operaciones | 8/8 |
| Clasificación y SEO | 10/10 |
| Digitales, servicios y combos | 15/15 |
| Contrato final de cierre | 8/8 |
| Cierre histórico con MongoDB | 20/20 |
| Sincronización de inventario | 14/14 |
| Variantes avanzadas | 14/14 |
| Archivo lógico | 7/7 |
| Catálogo con volumen | 7/7 |
| Taxonomía con MongoDB | 10/10 |
| Cumplimiento por tipo con MongoDB | 13/13 |
| Total de comprobaciones | 152/152 |

La compilación de Producción transformó 1.964 módulos correctamente.

### Dependencias

- Backend: 0 vulnerabilidades bajas, moderadas, altas o críticas en
  dependencias de Producción.
- Frontend: sin vulnerabilidades altas o críticas no autorizadas.
- React Router conserva una excepción documentada para dos avisos de modo RSC.
  La tienda funciona como SPA y el control confirmó que no usa React Server
  Components ni Server Actions; si esa arquitectura cambia, el CI bloqueará la
  excepción.

### Aislamiento de las pruebas

- MongoDB 7 se inicia como servicio temporal de GitHub Actions.
- Las pruebas crean identificadores únicos.
- Los productos, órdenes, sedes, clasificaciones, movimientos y existencias
  temporales se eliminan al finalizar.
- Los enlaces utilizados pertenecen a dominios `example`.
- El correo se simula mediante un `mailer` de prueba.
- No se envían correos reales, no se descargan archivos reales y no se procesan
  pagos reales.

## Comandos de verificación

Controles sin MongoDB:

```bash
npm --prefix backend run test:products-integrity
npm --prefix backend run test:products-public-security
npm --prefix backend run test:products-catalog-operations
npm --prefix backend run test:products-commercial-catalog
npm --prefix backend run test:products-fulfillment
npm --prefix backend run test:products-final-closure
npm --prefix frontend run build
```

Controles con una base MongoDB exclusiva para pruebas:

```bash
npm --prefix backend run test:products-module
npm --prefix backend run test:product-inventory-sync
npm --prefix backend run test:product-advanced-variants
npm --prefix backend run test:product-archive
npm --prefix backend run test:products-catalog-scale
npm --prefix backend run test:product-taxonomy
npm --prefix backend run test:product-fulfillment-integration
```

No deben ejecutarse las pruebas de integración contra la base normal de la
tienda.

## Configuración operativa requerida

Antes de activar el módulo en Producción deben verificarse:

- `MONGO_URI` o uno de sus alias aceptados;
- `DIGITAL_DELIVERY_TOKEN_SECRET` con un secreto largo, aleatorio y exclusivo;
- `PUBLIC_BACKEND_URL` con la URL pública HTTPS del backend;
- SMTP o correo productivo para las notificaciones;
- credenciales de almacenamiento de imágenes;
- una sede predeterminada y existencias iniciales correctas;
- permisos de Productos asignados únicamente a los perfiles autorizados;
- respaldo de MongoDB y monitoreo de órdenes con cumplimiento fallido.

Para aprovechar la atomicidad nativa del retiro se recomienda MongoDB Atlas o un
replica set con soporte de transacciones.

Los archivos digitales deben almacenarse en un origen privado o con acceso
controlado. No se deben registrar enlaces públicos permanentes como
`digitalDelivery.assetUrl`, porque el límite de descargas protege el acceso por
la tienda, pero no puede revocar un archivo publicado directamente por un
proveedor externo.

## Compatibilidad y migración

Los productos con categorías anteriores continúan funcionando. La migración a
la taxonomía estructurada puede ejecutarse de forma controlada con:

```bash
npm --prefix backend run migrate:categories
```

Antes de aplicar una migración sobre datos productivos se debe realizar respaldo
y verificar el resultado en un ambiente de ensayo.

## Commits principales

| Commit | Resultado principal |
|---|---|
| `cf8923e` | Privacidad y protección del catálogo público |
| `a3d2e28` | Integridad del guardado, variantes y retiro lógico |
| `f1d67e0` | Paginación, filtros y operaciones masivas |
| `4d4f641` | Categorías, colecciones, SEO y campos comerciales |
| `d9d90f8` | Implementación de digitales, servicios y combos |
| `38f928f` | Corrección final del cumplimiento posterior al pago |
| `609b793` | Contrato de cierre, auditoría de dependencias y CI definitivo |

## Criterio formal de cierre

A partir del commit técnico `609b793`, el módulo de Productos se considera:

- funcionalmente completo para el alcance definido;
- protegido en sus lecturas públicas y operaciones administrativas;
- consistente con inventario por sede y variante;
- escalable mediante consultas y paginación de MongoDB;
- compatible con productos físicos, digitales, servicios y combos;
- probado con datos temporales y sin integraciones reales;
- documentado;
- listo para integrarse a `main`.

La activación operativa en Producción es una fase posterior. Requiere completar
la configuración indicada y realizar ventas controladas de un producto físico,
uno digital, un servicio y un combo antes de habilitar el catálogo completo.
