# Privacidad y datos personales

La ruta `/privacidad` presenta un resumen inicial, cuatro temas desplegables, una guía de derechos, descarga íntegra y datos del responsable. Utiliza el material de vidrio compartido y el fondo continuo de Inicio en escritorio y móvil.

El usuario entra desde **Datos personales** en la fila pública de información al consumidor. Los enlaces de Privacidad del footer abren la misma ruta. En el panel se administra desde **Páginas → Datos personales**, cuyo nombre puede personalizarse.

## Presentación y configuración

La configuración se guarda en `informationPageConfig.privacyPage`. El editor agrupa:

- **Resumen de privacidad**: hasta seis elementos, editados uno a la vez; título, descripción, icono y visibilidad.
- **Lectura y descarga**: títulos de los temas, descarga, identificación y mensajes de carga.
- **Derechos y atención**: guía, elementos seleccionables y enlaces públicos seguros.
- **Composición de privacidad**: carga de ilustración desde el equipo mediante Cloudinary, medidas y distribución.

Colores, Fondo y cristal y Medidas y tipografía conservan sus controles comunes; la vista previa sigue fija. El guardado y la navegación se bloquean mientras se carga una imagen. La URL del sistema se muestra como solo lectura.

Las extensiones desconocidas, los valores personalizados, las listas explícitamente vacías y una ilustración vacía se conservan. La introducción predeterminada solo se adopta cuando coincide con la semilla original reconocida. La página no altera el contenido de otras páginas informativas.

## Fuente de la política

`backend/services/consumer/privacyDocument.js` utiliza una sola definición de cada fragmento para producir:

1. El texto canónico que ya consume el contrato de compra, conservando su orden y contenido.
2. `privacySections`, una representación adicional de lectura en cuatro temas: datos y finalidades, autorización y comunicaciones, conservación y proveedores, consultas y reclamos.

Los criterios de conservación, proveedores y vigencia siguen usando la configuración de Tienda. Tienda y Facturación conservan la fuente de los datos del responsable. El editor de apariencia no contiene otra copia de esos formularios.

Las políticas completas y las huellas de oferta son idénticas a las anteriores en los cuatro escenarios de regresión registrados antes de separar los temas. No cambia la revisión legal por un cambio de presentación ni se modifica una constancia histórica. Si en el futuro se modifica el contenido de una política, la revisión de su versión y de sus pruebas debe acompañar ese cambio deliberado.

`privacyPolicySections.js` comprueba que la representación por temas cubra todo el texto canónico, sin añadir fragmentos ajenos ni omitir contenido. Ante respuestas anteriores, incompletas o incompatibles, presenta el documento completo en un único apartado. No intenta reconstruir la política cortando frases por puntos o suponiendo el contenido de campos empresariales.

La descarga TXT contiene el texto canónico completo, la identidad del responsable y la referencia exacta, independientemente de los desplegables abiertos. El código de referencia mantiene su explicación y no se presenta como fecha de actualización. Esta página no muestra la nota de aceptación de una compra.

## Atención y protección de datos

El botón **Ejercer mis derechos** abre `/pqr?tipo=privacy_query`, que utiliza el tipo existente Consulta de datos personales. El consumidor puede cambiarlo antes de presentar su solicitud. No se marca la autorización ni se radica automáticamente.

El enlace Contactar tienda utiliza Contacto. Si se oculta la guía de derechos, se conserva el acceso a la solicitud junto a la descarga. El responsable, sus canales y el enlace a la SIC permanecen accesibles.

La vista previa permite abrir los temas y bloquea la descarga y la navegación externa. Un fallo de carga muestra un estado recuperable y no ofrece datos anteriores como vigentes. Una ilustración fallida deja una cabecera legible. Se conservan los mecanismos existentes de PQR, recuperación, acceso privado, aceptación y pedidos; no se agregan solicitudes automáticas ni procesos de supresión instantánea.

## Organización del código

- `PrivacyPageContent.jsx`: composición pública y descarga canónica.
- `privacyPageConfig.js`: configuración, normalización y validación de presentación.
- `privacyPolicySections.js`: comprobación de cobertura y compatibilidad de respuestas.
- `privacyPage.css`: estilos limitados a `.privacy-page`, adaptación y movimiento reducido.
- `PrivacyAppearanceControls.jsx`: controles agrupados del editor.
- `privacyDocument.js`: fuente única de los fragmentos de política y sus temas de lectura.
- `testPrivacyPresentation.js`: regresión de las políticas y huellas de compra anteriores, y cobertura completa de los temas.

## Ilustración decorativa

Destino: `frontend/public/consumer/crystal-privacy.webp`.

Original: `/workspace/scratch/8cbd4873f312/generated_images/exec-2a20603f-45ed-4e85-b165-95a415bd2227.png`.

Referencia visual: `/workspace/scratch/8cbd4873f312/generated_images/exec-f0b829ec-d49b-489a-8e6c-310c923c9344.png`.

Generada con la herramienta integrada ImageGen y fondo transparente. Conversión a WebP RGBA, calidad 88 y método 6, sin recortes, redimensionamiento ni retoques. Dimensiones: 1536 × 1024; 315810 bytes. El escudo y el candado son decorativos, no un certificado de seguridad o cumplimiento.

Prompt exacto:

> Use case: product-mockup / background-extraction. Recreate ONLY the decorative transparent glass shield with padlock from the upper right hero of the approved webpage reference, as one isolated asset on a genuinely transparent alpha background. Clear polished rosy crystal shield, fine luminous double refractive rim, burgundy padlock at center, burgundy satin ribbon with small bow crossing the base, small delicate blush roses and pale petals on either side at base. Same restrained elegant 3D material and proportions as the reference, soft peach-pink glints at glass corners, transparent interior with no opaque white plate. Landscape asset, all objects fully contained with space around edges. No text, no website elements, no logos, no legal certification badge, no black stains, no gray or pink rectangular background, no giant floor or solid shadow. Only the shield, lock, ribbon and roses; original background removed, preserve delicate crystal transparency for placement over an existing floral rose webpage.

## Validación

- 85 pruebas frontend en 16 archivos: páginas informativas, condiciones, cambios, envíos, PQR, privacidad, editores y cobertura de rutas.
- Cuatro escenarios de compatibilidad exacta de políticas y huellas de oferta, incluidos valores de configuración con puntos, saltos de línea y frases repetidas.
- 17 grupos existentes de protección al consumidor y 11 de acceso, recuperación y conexión de PQR.
- 18 controles Chromium: 1536, 1024, 768, 390 y 320 px; continuidad de fondo; ausencia de desbordamiento; ilustración; cuatro temas íntegros; teclado; descarga canónica; responsable y referencia; acceso al tipo real de PQR sin preautorizar; contacto; movimiento reducido; guardado y recarga del editor; color configurable; vista previa fija; servidor anterior; guía oculta; imagen fallida y recuperación de error.
- Compilación Vite de producción correcta.

Las comprobaciones de navegador usan los componentes reales, el generador real de políticas y respuestas controladas. No crean pedidos, PQR ni correos reales. Esta entrega organiza y presenta la política existente; la revisión legal integral y las verificaciones operativas de producción conservan su alcance separado.
