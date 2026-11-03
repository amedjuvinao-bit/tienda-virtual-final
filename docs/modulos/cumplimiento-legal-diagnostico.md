# Cumplimiento legal: diagnóstico de almacenamiento y terceros

Fecha: 2 de noviembre de 2026. Versión examinada: `bf62c00bbd9e5e8858ec0f0f70983bd7f75c9ad9`. Rama de trabajo: `feature/cumplimiento-legal`, creada desde la versión validada de Páginas.

## Resultado

La tienda tiene mecanismos de autorización y constancia en compras y PQR, seguridad administrativa mediante cookies HttpOnly y varias integraciones que esperan una acción del visitante. El siguiente trabajo debe completar la trazabilidad de las suscripciones, reducir conexiones externas iniciales y definir la conservación de selecciones del navegador. No procede considerar cerrado el cumplimiento legal con la presentación de las páginas.

Esta etapa contiene únicamente el diagnóstico. No cambia componentes, configuraciones guardadas, pedidos, inventario, autorizaciones históricas ni plazos de conservación. No introduce un banner de aceptación sin controles efectivos.

## Avance: suscripciones y retiro

La implementación de L-01, L-02 y L-03 está documentada en [Suscripciones y retiro](suscripciones-consentimiento.md): formulario compartido, autorización versionada, confirmación de correo, retiro verificable, constancia duradera y conexión específica del canal email con Clientes y Checkout. Se conserva el diagnóstico de la versión examinada como referencia del estado anterior. La comprobación de SMTP y base de datos en la instalación sigue siendo necesaria; L-04 a L-07 no se consideran resueltos por este cambio.

## Método y alcance

La implementación posterior de L-04 y L-06 se documenta en [Etapa 1: almacenamiento, preferencias y conexiones externas](cumplimiento-legal-etapa-1.md): fuentes locales, widget de pago por acción y controles de contenidos sociales y mapa con rechazo, cambio de decisión y vencimiento. L-05 y L-07 continúan pendientes de sus etapas de conservación y datos reales del negocio. El inventario siguiente conserva los hallazgos de la versión inicialmente examinada.

Se examinaron mediante búsqueda estática 1485 archivos `.js`, `.jsx`, `.ts`, `.tsx`, `.html` y `.css` de `frontend/src`, `backend` y la entrada `frontend/index.html`, excluyendo dependencias, scripts y archivos de pruebas. Se identificaron 28 archivos con referencias a almacenamiento del navegador o emisión de cookies; se revisaron sus consumidores y los servicios relacionados. Los nombres de claves heredadas se contrastaron con las rutas de migración y limpieza.

Los resultados describen funciones disponibles en el código. No se accedió a la base de datos, las variables privadas, la configuración efectiva del negocio ni los contratos de sus proveedores. No se ejecutó un rastreo de red de la instalación desplegada. Por ello, una integración disponible no demuestra que esté activa, y una URL externa no demuestra por sí sola que instale cookies de publicidad.

`frontend/index.html` es la entrada de Vite. El archivo `frontend/src/Index.html` y las páginas estáticas de `frontend/public/legal/` no se confunden con esa entrada ni con la política canónica pública de `/privacidad`. Las páginas estáticas de integración identifican un entorno de desarrollo y requieren su propia revisión si se publican para otro propósito.

## Almacenamiento del visitante

Las categorías siguientes describen la finalidad técnica; no constituyen una exención automática de autorización para cualquier tratamiento de datos personales.

| Clave | Medio | Contenido y finalidad observados | Duración y limpieza observadas | Evidencia |
| --- | --- | --- | --- | --- |
| `cart_access` | sessionStorage | Identificador del carrito y credencial, guardados juntos por pestaña | Sin vencimiento local propio; se elimina por la función de limpieza del acceso. El servidor valida la credencial | `frontend/src/utils/cartSessionStorage.js`, `cartAccess.js` |
| `cart_snapshot` | sessionStorage | Selección del carrito asociada a su identificador; recuperación visual ante una carga | Sesión de pestaña; sin plazo propio | `frontend/src/utils/cartSnapshotStorage.js` |
| `session_id`, `cart_shared_session` | localStorage | Identificadores para recuperar y coordinar el carrito entre pestañas; la credencial compartida circula por BroadcastChannel | Sin plazo local automático | `frontend/src/lib/api.js`, `frontend/src/utils/cartTabSync.js` |
| `cart` | localStorage | Copia de artículos del carrito, con importación de datos anteriores | Sin plazo local automático | `frontend/src/context/CartContext.jsx` |
| `favorite_access` | localStorage | Identificador y credencial de favoritos; persistencia entre visitas | Sin fecha local propia; el servidor decide si la credencial sigue siendo válida | `frontend/src/utils/favoriteAccess.js` |
| `favorite_snapshot`, `favorites` | localStorage | Copia de artículos favoritos; compatibilidad con la selección anterior | Sin plazo local automático | `frontend/src/utils/favoriteStore.js` |
| `favorite_pending` | sessionStorage | Operaciones de favoritos aún no confirmadas por el servidor | Sesión de pestaña; se actualiza tras sincronizar | `frontend/src/utils/favoriteStore.js` |
| `order_payment_access_v1` | sessionStorage | Pedido, sesión, credencial y vencimiento para gestionar el pago | Verifica `expiresAt` y elimina al consultar una credencial vencida. El servidor emite por defecto acceso de 24 horas | `frontend/src/utils/orderPaymentAccess.js`, `backend/services/publicPaymentAccessService.js` |
| `order_return_access_v1` | localStorage | Pedido, credencial y vencimiento para acceder al portal de devoluciones | Verifica `expiresAt` y elimina al consultar una credencial vencida. El servidor usa por defecto 400 días; requiere revisar su justificación, sin reducirlo en este diagnóstico | `frontend/src/utils/orderReturnAccess.js`, `backend/services/orderReturnAccessService.js` |
| `rb_storefront_scroll_v1` | sessionStorage | Posición, ruta y sección para regresar con Atrás | Conserva hasta 50 entradas; sin plazo adicional | `frontend/src/lib/storefrontScrollRestoration.js` |
| `storefront_loading_appearance` | localStorage | Colores, imágenes y presentación de carga; continuidad visual antes de React | Sin plazo local automático; puede referenciar imágenes alojadas fuera de la tienda | `frontend/index.html`, `frontend/src/theme/storefrontLoadingAppearance.js` |
| `rosa-instagram-saved:${account}` | localStorage | Identificadores de publicaciones guardadas por el visitante para una cuenta | Hasta 100 identificadores; sin plazo local automático. El botón permite retirar publicaciones | `frontend/src/components/instagram/useJournalSaved.js` |

sessionStorage está vinculado a la sesión de navegación de la pestaña; la restauración del navegador puede recuperar esa sesión. No se presenta su cierre como una garantía de borrado inmediato. La caducidad de una credencial tampoco equivale al borrado del pedido, la lista de productos o sus copias de seguridad.

Las claves antiguas `cart_access_token`, `favorite_session_id` y `favorite_access_token` intervienen en migraciones. Las claves `admin_token`, `auth` y `admin_user` se retiran en los flujos revisados; no se describen como el mecanismo actual de autenticación.

Favoritos no emite un acceso nuevo al iniciar una visita sin credencial ni operaciones pendientes: `favoriteStore.js` termina esa sincronización sin crearlo. Debe mantenerse esta separación entre visitar la tienda y solicitar una selección persistente.

## Cookies y preferencias administrativas

No se identificó escritura mediante `document.cookie` en las fuentes examinadas ni una cookie publicitaria propia. Las cookies emitidas directamente por el backend pertenecen a los flujos siguientes; un proveedor externo podría emitir otras cuando se cargue su contenido.

| Cookie o grupo | Finalidad | Vigencia del código | Condiciones observadas |
| --- | --- | --- | --- |
| `rb_admin_access` | Sesión administrativa | 15 minutos por defecto, configurable entre 5 y 60 | HttpOnly; Secure y prefijo `__Host-` cuando corresponde |
| `rb_admin_refresh` | Renovación de sesión administrativa | Hasta el vencimiento absoluto de la sesión; 168 horas por defecto, configurable | HttpOnly; ruta `/api/admin/auth`; prefijo `__Secure-` cuando corresponde. La inactividad tiene control independiente |
| `rb_admin_2fa` | Desafío de doble factor | 5 minutos por defecto | HttpOnly; ruta `/api/admin/auth/2fa`; prefijo `__Secure-` cuando corresponde |
| `rb_admin_device` | Identificación de dispositivo para la seguridad administrativa | 365 días | HttpOnly; prefijo `__Host-` cuando corresponde; revisar necesidad y divulgación de este plazo |
| `rb_media_download` | Ticket de descarga administrativa | 90 segundos; consumo único | HttpOnly; prefijo `__Host-` cuando corresponde |
| `ig_oauth_state`, `tt_oauth_state` | Vincular el retorno OAuth con el inicio de conexión de la cuenta | 10 minutos | HttpOnly, SameSite Lax, ruta del callback y limpieza al regresar; son del proceso de conexión, no de toda visita pública |

Fuentes: `backend/security/adminSessionService.js`, `backend/services/mediaDownloadTicketService.js`, `backend/routes/instagram.js` y `backend/routes/tiktok.js`. La vigencia y SameSite efectivos dependen de la configuración del servidor. El código aplica Secure en producción para las sesiones administrativas. TikTok establece Secure también en su flujo OAuth.

El panel guarda además presentación y estado de interacción en localStorage: `rb_admin_loader_model`, colores de carga, `admin_sidebar_collapsed`, `admin_seen_review_ids`, `orders-admin-control-toggle-position-v1`, `rb_site_settings_tick` y `rb_admin_logout_pending`. El login utiliza `admin_login_failed_attempts`, `admin_login_lock_until`, `admin_login_remember` y `admin_login_remember_username`; esta última contiene el usuario recordado cuando se solicita. No se propone someter la seguridad administrativa a un interruptor de publicidad.

## Servicios externos y momento de contacto

| Servicio | Activación observada | Evaluación y trabajo necesario | Evidencia |
| --- | --- | --- | --- |
| Google Fonts | `frontend/index.html` abre conexiones anticipadas y solicita CSS. Catálogo y detalle importan también fuentes externas | Existe conexión inicial sin una decisión específica sobre ese proveedor. Alojar las familias y pesos utilizados en la tienda permitiría eliminar esas peticiones conservando el diseño y las licencias. No se clasifica esta conexión como cookie publicitaria por su sola presencia | `frontend/index.html`, `frontend/src/components/catalog/catalogPage.css`, `frontend/src/components/product-detail/productDetail.css` |
| Cloudinary y otros alojamientos de imágenes o video | Al cargar recursos que estén configurados con URL externa, incluso fondos de carga recordados | Identificar dominios realmente usados, información técnica transmitida y acuerdos aplicables. Subir una imagen desde el panel y mostrarla al público son flujos distintos | `backend/routes/uploadRoutes.js`, controles de medios y componentes de presentación |
| Instagram | El feed conectado se consulta mediante el backend; imágenes, perfil y videos pueden apuntar al proveedor de medios | No se encontró un widget iframe de Instagram en los componentes revisados. El feed del backend no evita las peticiones del navegador a las imágenes externas | `frontend/src/components/instagram/InstagramJournal.jsx`, `backend/services/instagramService.js` |
| TikTok | El reproductor moderno monta iframe al iniciar reproducción o seleccionar un video; el modelo anterior lo monta cuando `playing` es verdadero. Las portadas pueden cargarse antes | Ya existe carga diferida del reproductor, pero no un control central de autorización informada para contenido externo. El botón de reproducción por sí solo no documenta qué tratamiento se explicó | `frontend/src/components/tiktok/TiktokPlayer.jsx`, `TiktokStage.jsx`, `frontend/src/components/TiktokSection.jsx` |
| OpenStreetMap / Google Maps | El mapa inicial es un dibujo local. El iframe de OpenStreetMap se monta al activar el mapa interactivo; Google Maps se abre mediante enlace | Mantener la carga voluntaria y explicar el proveedor antes de conectarlo. El iframe usa `referrerPolicy="no-referrer"`, sin que eso suprima la conexión al tercero | `frontend/src/components/information-page/ContactMap.jsx`, `contactPageConfig.js` |
| Wompi | Si el proveedor configurado es Wompi y está activo, Checkout precarga `widget.js` mediante un efecto, antes de abrir el pago | Revisar la necesidad de la precarga y valorar cargar solo al solicitar el pago. No confundir el proveedor de pago con publicidad ni bloquear compras con un control de marketing | `frontend/src/checkout/page/useCheckoutConfiguration.js`, `checkoutWompi.js`, `useWompiCheckout.js` |
| PayU | Redirección por el flujo de pago correspondiente | Informar el proveedor y revisar los datos enviados en ese flujo | `frontend/src/lib/payuRedirect.js`, `frontend/src/checkout/page/useCheckoutSubmission.js` |
| Factus, Envia y correo SMTP | Integraciones de backend según configuración y operación | Incluir los proveedores efectivos, finalidades y reglas de conservación en la documentación del responsable. No son cookies del visitante por el hecho de existir como integraciones | Servicios de facturación y envíos, `backend/lib/mail/mailer.js`, `backend/lib/mailer.js` |
| WhatsApp y enlaces sociales | Navegación externa al pulsar los enlaces | Diferenciar un enlace voluntario de un recurso incrustado que ya conecta al cargar | Componentes de encabezado, footer y contacto |

No se identificaron inicializaciones explícitas de Google Analytics, Google Tag Manager, Meta Pixel, Hotjar o Microsoft Clarity en la entrada, dependencias y fuentes revisadas. Esta conclusión no cubre scripts añadidos por alojamiento, proxy, extensiones o cambios de configuración fuera del repositorio. `schema.org` y `www.w3.org` aparecen como vocabularios o espacios de nombres, no como prueba de contacto de red.

## Autorizaciones y suscripciones

### Mecanismos existentes que se deben conservar

- Compra: `acceptConsumerOffer` exige aceptación de condiciones y privacidad, comprueba la huella de la oferta y conserva la oferta con `acceptedAt`, `termsAccepted` y `privacyAuthorized`. No debe sustituirse por una aceptación genérica de cookies.
- PQR: exige autorización y versión de privacidad vigente; guarda fecha, versión, vendedor y política en la solicitud. `/pqr` ya es un canal para ejercer derechos sobre los datos.
- Checkout: la suscripción comercial empieza en `false` y la casilla es opcional. La intención `wantsNewsletter` se transmite por separado. Debe revisarse la evidencia específica de finalidad y canal comercial, sin eliminar la compra cuando no se autoriza marketing.
- Clientes: existen estado e historial de consentimiento, referencia de prueba y retiro administrativo. También existen controles de conservación y anonimización. Estos mecanismos deben integrarse con las suscripciones; no procede crear otra identidad de cliente ni declarar que no existe gestión de derechos.

Fuentes: `backend/services/consumer/checkoutContract.js`, `backend/services/consumer/cases.js`, `frontend/src/checkout/page/useCheckoutState.js`, `CheckoutContactSection.jsx`, `backend/routes/adminCustomers.js` y `backend/models/Customer.js`.

### Hallazgos que requieren corrección

| ID | Prioridad | Comportamiento confirmado | Corrección propuesta y criterio de cierre |
| --- | --- | --- | --- |
| L-01 | Alta | `FooterNewsletter.jsx` envía `consent:true` al enviar el correo. El controlador solo exige ese booleano; `Subscriber` guarda contacto, origen y fechas, sin texto/versionado de la autorización. No hay explicación de privacidad dentro del formulario compartido | Presentar finalidad, responsable, acceso a política y una decisión inequívoca, sin premarcado. Registrar evidencia de esa decisión con versión, texto y origen verificables. No afirmar que una casilla sea el único mecanismo legal posible ni recoger más datos de los necesarios para la prueba |
| L-02 | Alta | `/api/newsletter` ofrece suscripción. La colección `Subscriber` no representa retiro; Clientes sí registra consentimiento y PQR admite solicitudes de privacidad | Definir el retiro verificable y su propagación a suscriptores, Clientes y cualquier envío comercial. Conservar el canal PQR y sus plazos. Probar que un retiro impide nuevos envíos y que una compra sin marketing no vuelve a activar una autorización retirada |
| L-03 | Media | El footer clásico presenta un formulario de suscripción sin manejador de envío ni integración con el controlador | Reutilizar el mismo flujo de suscripción y autorización corregido en ambos diseños. No dejar un botón que aparente guardar el correo sin hacerlo |
| L-04 | Media | Se solicitan fuentes externas desde la entrada y CSS; Checkout precarga el widget de Wompi cuando está habilitado | Reducir conexiones iniciales innecesarias; conservar las fuentes aprobadas y revisar la precarga del pago. Verificar en red los proveedores contactados antes de interactuar |
| L-05 | Media | Hay selecciones y preferencias persistentes sin vencimiento local. Cart y Favorite no declaran TTL para borrar listas por antigüedad; sí existen eliminaciones explícitas. Clientes tiene su propia gestión de conservación | Definir tiempos por finalidad y procedimientos coordinados de conservación, limpieza y retirada, sin borrar pruebas de compra ni datos de conservación obligatoria. Un plazo escrito en la política no sustituye el procedimiento operativo |
| L-06 | Media | Los reproductores y el mapa tienen activación diferida; no se encontró un gestor común de preferencias para contenido externo con versión y cambio de decisión | Diseñar un control proporcionado al inventario real, informar antes del contacto que lo requiera y hacer efectiva la decisión. No añadir categorías de analítica o publicidad que la tienda no utilice |
| L-07 | Requiere comprobación del negocio | La política canónica informa conservación, proveedores y vigencia desde configuración, y el checkout tiene controles de preparación. No se verificaron sus valores reales | Confirmar identidad, canales, proveedores efectivos, países cuando proceda, contratos y plazos. Mantener una sola fuente en Configuración y `/privacidad`; versionar cualquier cambio material y respetar constancias históricas |

L-01 se apoya en `frontend/src/components/footer/FooterNewsletter.jsx`, `backend/controllers/newsletterController.js` y `backend/models/Subscriber.js`. L-02 incluye `backend/routes/newsletter.js`, `backend/services/orderCreationNewsletterService.js`, `backend/services/customerOrderLink/normalization.js`, `matching.js`, `sync.js` y la gestión de consentimiento de Clientes. La suscripción de Checkout conserva su intención en el pedido, pero eso no debe confundirse automáticamente con una prueba completa del texto y canal comercial informados.

## Criterios normativos utilizados

La Ley 1581 de 2012 distingue la autorización previa e informada y sus excepciones; también exige informar finalidad, derechos e identidad del responsable. Los artículos 2.2.2.25.2.4 a 2.2.2.25.2.6 del Decreto 1074 de 2015 regulan manifestación, prueba y retiro; el 2.2.2.25.2.8 limita conservación según finalidad y obligaciones aplicables. Por ello, usar localStorage en lugar de una cookie no elimina la evaluación del tratamiento, y llamar un dato «funcional» no decide por sí solo su régimen jurídico.

La resolución de la SIC sobre TikTok examinada explica que las cookies pueden recolectar datos personales y someter ese tratamiento a la legislación colombiana. Sus órdenes particulares no se trasladan íntegramente a esta tienda. Tampoco se deduce que cualquier conexión externa sea publicidad o que todo sitio deba copiar un banner idéntico. La elección técnica debe corresponder a las finalidades y datos efectivamente tratados.

Fuentes primarias consultadas:

1. [Ley 1581 de 2012, artículos 4, 9, 10, 12 y 17](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981).
2. [Decreto 1074 de 2015, capítulo 25](https://cancilleria.gov.co/sites/default/files/Normograma/docs/decreto_1074_2015_pr025.htm).
3. [SIC, Resolución 14015 de 2021, explicación sobre cookies y tratamiento, hoja 12](https://sedeelectronica.sic.gov.co/sites/default/files/estados/072022/RE14015-2021.pdf).
4. [SIC, criterio sobre silencio, premarcado y prueba de la autorización](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/boletin/el-silencio-las-casillas-premarcadas-por-defecto-y-la-inaccion-no-constituyen-el-consentimiento-conforme-con).
5. [Google Fonts, explicación oficial sobre privacidad y recepción de direcciones IP](https://fonts.googleblog.com/2022/11/your-privacy-and-google-fonts.html). Es documentación del proveedor, no una conclusión de cumplimiento de la tienda.

## Orden propuesto para las correcciones

1. Resolver L-01, L-02 y L-03 como un flujo coherente de suscripción y retiro, compartido por los dos footers y conectado con los mecanismos existentes de Clientes y Checkout.
2. Reducir conexiones iniciales y preparar la decisión informada sobre contenido externo: L-04 y L-06. Mantener las funciones de pago y el diseño aprobado.
3. Definir conservación y revisar la política con datos del negocio: L-05 y L-07. No inventar proveedores, plazos ni autorizaciones históricas.
4. Validar en una instalación representativa: almacenamiento nuevo y existente, solicitudes de red, rechazo y cambio de preferencias, retiro comercial y conservación de carrito, favoritos, pagos y PQR.

Cada corrección requiere su revisión y aprobación como paso siguiente. Este diagnóstico no certifica la operación desplegada ni sustituye la verificación del responsable sobre su tratamiento real.
