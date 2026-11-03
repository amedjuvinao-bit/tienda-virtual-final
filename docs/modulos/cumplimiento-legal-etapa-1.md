# Etapa 1: almacenamiento, preferencias y conexiones externas

La tienda permite decidir por separado sobre contenidos sociales e interacción con el mapa. Las decisiones empiezan desactivadas. Aceptar, rechazar o modificar una elección controla las cargas de esos contenidos; no concede autorización comercial por correo ni bloquea la compra.

## Cambios disponibles

| Elemento | Comportamiento |
| --- | --- |
| Fuentes | Se sirven desde `/fonts/`, con las 21 familias antes obtenidas desde Google y sus estilos de tienda y editor; Bodoni Moda conserva sus archivos locales anteriores. Los archivos WOFF2 y sus licencias OFL están incluidos en el repositorio. No se necesitan descargas de Google Fonts durante una visita o compilación. |
| Wompi | La configuración del checkout ya no precarga el widget. La acción existente de iniciar el pago continúa cargándolo y conserva su validación y configuración. El pago no depende de aceptar contenidos sociales o mapas. |
| Instagram y TikTok | En la portada pública, sus componentes, publicaciones, imágenes y reproductores no se montan hasta permitir contenidos sociales. Se conservan los diseños y ajustes existentes, incluidos ambos modelos de TikTok y las vistas del editor. |
| Mapa interactivo | El esquema local y los enlaces siguen disponibles. El iframe de OpenStreetMap se monta después de solicitar el mapa y permitir esa categoría. |
| Retirada | Desmonta los contenidos abiertos y evita sus nuevas cargas. La decisión se propaga entre pestañas. No borra datos ya recibidos ni cookies del dominio de un proveedor. |
| Política pública | Datos personales incorpora el apartado Cookies y contenidos externos. El aviso del control y el documento del servidor usan el mismo contenido compartido. La política íntegra sigue formando parte del versionado y de las constancias existentes. |

El acceso **Cookies y preferencias** permanece en la franja pública de información al pie de las páginas, incluso tras rechazar. El aviso inicial ofrece rechazo, aceptación y configuración; no se premarcan categorías opcionales. Cerrar la configuración sin guardar no concede permisos. El control no se muestra en las rutas del panel administrativo.

## Registro y conservación de la preferencia

`rb_privacy_preferences_v1` guarda únicamente la decisión local: categorías, versión del aviso, método, fecha y vencimiento. No incluye correo, identidad de cliente ni un identificador de seguimiento. Se utiliza un máximo técnico de 180 días para recordar la decisión y volver a pedirla; no representa un plazo legal general de conservación de datos del negocio.

Una preferencia vencida, antigua, malformada o con valores no booleanos deja desactivado el contenido opcional. El vencimiento también se comprueba con la pestaña abierta y al recuperar el foco. Si el navegador bloquea el almacenamiento, la decisión solo se aplica en memoria durante esa visita. Rechazar o retirar no elimina el carrito ni los favoritos.

La constancia local describe la preferencia de ese navegador. No sustituye la prueba identificada de suscripción, la gestión de solicitudes de datos ni una certificación de consentimiento de todos los tratamientos del negocio.

## Alcance del inventario

El control abarca las secciones sociales de la portada y el mapa incrustado. Los recursos de producto, fondos, logotipos y otros medios propios pueden seguir cargándose desde el alojamiento o CDN configurado para prestar la tienda; deben identificarse en los proveedores reales del responsable. Un enlace voluntario a WhatsApp, Google Maps o redes sociales sigue siendo navegación al destino elegido, no una carga automática de su iframe.

No se incorporan analítica, publicidad ni un interruptor de marketing ficticio. Las cookies administrativas de sesión y seguridad permanecen independientes de estas preferencias. Factus, Envia y SMTP mantienen sus operaciones de backend.

Cambiar los proveedores opcionales o su tratamiento requiere revisar `shared/storefrontPrivacyPreferences.json` y aumentar su versión. Los valores efectivos de conservación, identidad y proveedores del negocio continúan en Configuración y requieren su cierre en las etapas siguientes. Los snapshots y autorizaciones históricos no se reescriben al actualizar el texto publicado; los códigos pendientes de suscripción siguen comprobando la versión vigente.

## Validación

- Pruebas de preferencias: ausencia de autorización por visita, categorías separadas, rechazo, cambios, caducidad, datos inválidos, almacenamiento bloqueado y cambios entre pestañas.
- Pruebas de interfaz: permisos sin premarcado, cierre sin guardar, foco y ciclo de teclado del diálogo, contenido desmontado tras el retiro y separación del panel administrativo.
- Contratos de política: cinco apartados sin pérdida del documento íntegro; compatibilidad con respuestas anteriores; contenido dentro del límite de las constancias.
- Integridad de las 21 familias, 134 archivos WOFF2 y licencias: hashes, formato y referencias locales.
- Recorridos Chromium a 1440, 768, 390 y 320 px: ninguna petición a los proveedores controlados antes de elegir, mapa permitido sin redes, reproducción social después de permitir, retirada de iframes abiertos, rechazo persistente y Wompi solicitado solo al pulsar la acción. Todos los destinos de proveedor y las APIs se sustituyen por respuestas controladas: no se ejecutan cobros ni se accede a datos privados.
- Regresiones del formulario de suscripción, compra, PQR, páginas informativas, footers, Instagram y TikTok; contratos de backend de suscripciones y protección al consumidor; compilación de producción.

Comandos: `npm run test:privacy-preferences` en frontend y backend; `npm run test:e2e:privacy-preferences` en frontend. El recorrido acepta `PLAYWRIGHT_EXECUTABLE_PATH` para usar un Chromium instalado. `vendorLocalFonts.py` es una herramienta opcional de mantenimiento de fuentes; no se ejecuta al instalar ni al compilar la tienda.

## Comprobación después de actualizar

1. Actualizar la rama y reiniciar el backend; en producción, volver a compilar el frontend.
2. Abrir una ventana nueva sin preferencias y comprobar el aviso. Rechazar y verificar que la navegación, el carrito y el checkout siguen disponibles.
3. Abrir Cookies y preferencias, permitir solo el mapa y solicitar el mapa interactivo. Las redes deben continuar desactivadas.
4. Permitir redes, abrir un video y retirar esa categoría: el reproductor debe desaparecer. La misma decisión debe aplicarse en otra pestaña abierta.
5. Comprobar el documento publicado en `/privacidad#privacy-cookies` y el acceso para cambiar la decisión.
6. Revisar en la instalación real las solicitudes de red y los dominios configurados, incluidas las imágenes propias servidas por terceros. Los resultados de desarrollo no verifican scripts introducidos por alojamiento, proxy o configuración fuera del repositorio.

La etapa implementa los controles técnicos de los puntos 4, 5 y 8 del cronograma. El cierre de conservación, datos reales del negocio, accesibilidad integral, contenidos, derechos de imágenes y operación productiva continúa en las etapas siguientes.

## Fuentes primarias

- Google Fonts, privacidad y datos recibidos: https://developers.google.com/fonts/faq/privacy
- Google Fonts, fuentes y licencias: https://github.com/google/fonts
- Wompi, widget y checkout: https://docs.wompi.co/docs/colombia/widget-checkout-web/
- OpenStreetMap Foundation, privacidad: https://osmfoundation.org/wiki/Privacy_Policy
- SIC, autorización y casillas premarcadas: https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/boletin/el-silencio-las-casillas-premarcadas-por-defecto-y-la-inaccion-no-constituyen-el-consentimiento-conforme-con
