# Envíos y entregas: página pública

Ruta canónica `/envios`, rol `consumer-shipping`. La página utiliza la colección y el editor de páginas informativas existentes. `/politicas` conserva compatibilidad y redirige a `/envios`; los enlaces predeterminados del footer utilizan la dirección canónica. `/cambios-devoluciones` redirige a `/cambios-y-devoluciones` para mantener el otro acceso anterior del footer.

## Composición

Cabecera compacta con ilustración de paquete de cristal; recorrido de cuatro pasos; bloque de costo y plazo; bloque de cobertura con marcador decorativo; franja de Contacto y PQR. El fondo hereda el de Inicio, incluido el comportamiento móvil, mediante `ServicePageFrame` y `useStorefrontBackdrop`. El header y el footer siguen usando la apariencia configurada.

El vidrio emplea `ContactGlassRim`: contornos vectoriales finos, refracción y reflejos localizados en el perímetro. Los paneles se tiñen con el color y la transparencia del editor, sin una superficie blanca superpuesta. El borde cero y los ajustes decimales siguen disponibles. El movimiento se desactiva con la preferencia del dispositivo o con el control del editor.

Los cuatro pasos son descriptivos; no representan estados de un pedido consultado. Se pueden editar, ordenar, ocultar y ampliar hasta seis. Los pasos incompletos se crean ocultos y se valida su contenido antes de publicarlos. Una lista vacía se conserva vacía.

## Datos y condiciones

El resumen explica que el costo y el plazo se informan al comprar. No muestra precios fijos, transportadoras, cobertura nacional, seguimiento en vivo ni cotización automática por peso. La integración de cotizaciones sigue perteneciendo a su mejora logística separada.

Las condiciones completas se obtienen del mismo `/api/consumer/information` usado por la compra. Permanecen accesibles mediante un desplegable y una descarga. Allí se muestran identidad, contactos, destinos y compromiso de entrega vigentes. La recogida aparece únicamente si el servidor la informa habilitada y con instrucciones. No se duplican datos de Tienda, Facturación o Envíos en formularios nuevos. Un fallo de consulta muestra un aviso visible y permite reintentar.

## Administración

**Páginas → Envíos y entregas**:

- Título y presentación.
- Proceso de entrega: selección de un paso, contenido, icono, orden y visibilidad.
- Costo, plazo y cobertura: títulos, descripciones y bloques visibles.
- Ayuda y enlaces: textos y destinos públicos de los botones, etiquetas de consulta y descarga.
- Diseño → Composición de envíos: ilustraciones, carga desde PC a Cloudinary, medidas y movimiento.
- Los temas comunes reúnen fondo, vidrio, colores, medidas y visibilidad. La vista previa permanece fija en escritorio y permite móvil.

La nueva configuración vive en `informationPageConfig.shipping`. La adopción sustituye solamente los textos iniciales reconocibles de la plantilla anterior y su tamaño de título inicial. Los contenidos propios, colores, imágenes, extensiones y ajustes de material guardados se conservan. Los enlaces se normalizan y rechazan destinos administrativos o ejecutables. Las acciones de la vista previa no navegan ni descargan documentos.

## Ilustraciones

`frontend/public/shipping/crystal-parcel.webp` y `crystal-location.webp` son ilustraciones decorativas generadas con ImageGen a partir del diseño seleccionado. No muestran paquetes reales ni una ubicación geográfica. Ambos archivos conservan canal alfa y pueden cambiarse u ocultarse desde el editor.

Prompt del paquete: extraer del diseño seleccionado únicamente el paquete de cristal con lazo burdeos, corazón y rosa; eliminar toda interfaz, texto y fondo; conservar bordes refractivos y transparencia real.

Prompt del marcador: extraer del mismo diseño únicamente el marcador de cristal rosado con su pequeña rosa y pétalos; eliminar tarjetas, texto y fondo; conservar abertura transparente y contornos biselados.

## Validación

Pruebas de normalización, configuración propia y vacía, enlaces seguros, campos visibles incompletos, recogida del servidor, carga fallida, imágenes fallidas, vista previa y persistencia del editor. Contratos existentes de páginas y protección del consumidor. Revisión Chromium en 1536, 1024, 768, 390 y 320 px; enlaces, teclado, descarga, guardado, vista previa fija y reintento de consulta. Las API y los datos de esas pruebas están controlados; no se realizaron compras ni operaciones con transportadoras.
