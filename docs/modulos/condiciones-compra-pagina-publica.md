# Condiciones de compra

La ruta `/terminos` presenta las condiciones vigentes con un índice de seis temas, apartados desplegables, descarga íntegra y acceso a los datos del vendedor. El diseño utiliza el material de vidrio existente y el fondo continuo de Inicio, también en móvil.

## Organización

- `TermsPageContent.jsx`: composición pública, índice, navegación por fragmentos, lectura y descarga.
- `termsPageConfig.js`: valores iniciales, normalización y validación de presentación.
- `termsPage.css`: estilos limitados a `.terms-page`, tipografía local, adaptación y movimiento reducido.
- `TermsAppearanceControls.jsx`: controles del editor agrupados en Índice y descarga, Ayuda e información y Composición de condiciones. Colores, Fondo y cristal y Medidas y tipografía conservan sus controles compartidos.

La configuración se guarda en `informationPageConfig.termsPage` mediante el flujo existente de Páginas. Conserva extensiones desconocidas y una ilustración vacía explícita. Solo se sustituye la introducción de la semilla original reconocida; los textos y colores personalizados se mantienen. El identificador de sistema y la dirección protegida se conservan.

## Condiciones y funcionamiento

El contenido procede de `useConsumerInformation`, sin otra copia de las políticas en el editor. Tienda y Facturación proporcionan la identidad, Envíos las condiciones de entrega y Órdenes la política comercial de cambios. Las reglas de datos personales conservan su fuente actual. El editor modifica la presentación y las etiquetas del índice; los apartados del documento conservan los títulos y textos del servidor.

El índice abre el apartado correspondiente y mueve el foco a su cabecera. Los fragmentos `#condiciones-terminos`, `#condiciones-envios`, `#condiciones-retracto`, `#condiciones-garantia`, `#condiciones-reversion` y `#condiciones-privacidad` admiten acceso directo e historial. Se pueden mantener varios apartados abiertos. La apertura de una página o un apartado no acepta condiciones ni crea pedidos.

El índice permanece fijo en escritorio cuando cabe completo en la altura disponible. Un observador de tamaño lo libera si no cabe; no existe barra de desplazamiento interna. En pantallas de hasta 900 px se coloca antes del documento. El desplazamiento a un apartado respeta la separación superior configurable.

La descarga TXT incluye la referencia exacta, los datos del vendedor y los seis textos completos disponibles, independientemente de los apartados abiertos o de la visibilidad del índice. Ocultar el índice mantiene una descarga y un enlace de ayuda alternativos. El error de carga oculta el documento y permite reintentar; no ofrece descargar información obsoleta como vigente.

La constancia histórica de cada pedido, sus huellas, las aceptaciones de checkout y la lógica de PQR permanecen en sus implementaciones existentes. La referencia técnica se consulta en un desplegable con su explicación. Los datos del vendedor y el enlace a la SIC siguen accesibles.

La vista previa permite abrir apartados mediante botones locales, bloquea la descarga y mantiene los bloqueos de navegación y operaciones del editor. Las imágenes usan la carga existente desde el equipo a Cloudinary, con bloqueo de guardado y navegación mientras suben. Si falla una imagen se conserva una cabecera legible.

## Recurso decorativo

Destino: `frontend/public/consumer/crystal-document.webp`.

Original: `/workspace/scratch/8cbd4873f312/generated_images/exec-bf2b0152-68a9-428a-89a3-58249dc89a8b.png`.

Referencia visual: `/workspace/scratch/8cbd4873f312/generated_images/exec-d556090f-b084-4bea-ae10-250880923232.png`.

Generación: herramienta integrada ImageGen, fondo transparente. Se convirtió a WebP RGBA con calidad 88 y método 6, sin recorte, redimensionamiento ni retoque. Tamaño: 1536 × 1024; 258492 bytes. Ilustración decorativa, no fotografía del negocio ni sello de certificación.

Prompt exacto:

> Use case: background-extraction / product-mockup. Create one isolated transparent PNG decorative hero asset faithfully matching ONLY the crystal document illustration in the upper right of the provided approved website mockup. A clear transparent rosy glass sheet/document with a neatly folded upper corner and four fine embossed horizontal text-like lines (no actual words); burgundy satin ribbon wrapping near the lower third with a small rose wax seal; a smaller transparent glass outlined shield with check at right. Small delicate blush roses and a few pale petals along the base only. Same fine glowing refractive edges, graceful three-dimensional polished clear material, soft peach highlights and burgundy ribbon. Landscape isolated composition, all objects fully visible with space around edges. Genuinely transparent background alpha, no pink rectangle, no opaque white panel, no text, no branding, no cast black blotches or gray backdrop. Preserve delicate crystalline details, moderate tasteful size. This asset will sit over the existing continuous blush floral page background. Do not generate any website UI, header, buttons or webpage text; just the extracted/recreated document-shield-and-roses arrangement.

## Validación

- 75 pruebas frontend en 15 archivos: páginas informativas, envíos, cambios, PQR, condiciones, editores y cobertura de rutas.
- 17 grupos existentes de protección al consumidor y 11 de acceso, recuperación y conexión de PQR.
- Navegador Chromium: presentación en 1536, 1024, 768, 390 y 320 px, continuidad de fondo, ausencia de desbordamiento, recurso transparente, teclado, descarga completa, fragmentos, historial y foco, índice fijo y altura corta sin barra interna, movimiento reducido, guardado y recarga del editor, vista previa, ayuda, índice oculto y recuperación tras error.
- Compilación Vite de producción correcta.

Las comprobaciones de navegador utilizan respuestas controladas con el generador real de políticas y los componentes reales; no crean pedidos, PQR ni correos reales. La presencia y los datos de la instalación de producción no se infieren de estas pruebas. Este cambio presenta las condiciones existentes; no certifica el cumplimiento operativo ni sustituye la revisión legal planificada.
