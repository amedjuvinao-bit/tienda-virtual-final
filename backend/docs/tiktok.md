# TikTok: escenario de videos y cuenta conectada

El diseño de tres columnas muestra identidad y textos, un video vertical principal y una lista lateral con selección individual. El fondo floral de satén reutiliza el recurso de Instagram. Todos los textos son editables y no hay nombres comerciales fijos. En móvil se apilan las tres áreas. La implementación anterior se conserva con `config.stageLayout = 'legacy'`.

## Administración

- Configuración → TikTok: cuenta, credenciales y ayuda. Se guardan Client Key, Client Secret y permiso de publicación. El secreto vacío conserva el existente. La conexión principal es por QR y no exige introducir una URL de retorno para iniciarla. La autorización en ventana web se conserva como opción avanzada con URL HTTPS. Hay controles de guardar, generar/cancelar QR, comprobar estado, sincronizar y desconectar.
- Apariencia → TikTok → Contenido: cuenta/manual, identidad, textos y videos. Cada video puede ocultarse, mostrarse, marcarse como principal y ordenarse manualmente. Los títulos de videos conectados admiten un reemplazo local sin editar TikTok. La aprobación de nuevos videos puede ser automática o manual.
- Apariencia → TikTok → Diseño: fondo, distribución, tipografía, colores, cristal, animaciones, móvil y visibilidad. La vista previa comparte el feed privado, incluida la selección aún no publicada.

## Conectar la cuenta

1. Configurar una app en TikTok for Developers con Login Kit y Display API. Autorizar `user.info.basic` y `video.list`. TikTok debe aprobar los productos/permisos o permitir la cuenta en el entorno de prueba. Usar Client Key y Client Secret del mismo entorno.
2. Para trabajar desde la PC: guardar ambas credenciales, volver a Cuenta y pulsar Generar QR de TikTok. Escanear con la app de TikTok, confirmar los permisos y mantener el panel abierto hasta la confirmación. No se publica hosting ni se crea un túnel. Las peticiones de comprobación salen del backend hacia TikTok; el teléfono no intenta acceder al localhost de la PC. La disponibilidad del método y los permisos siguen dependiendo de la app de TikTok.
3. El backend necesita `TIKTOK_ENCRYPTION_KEY` de al menos 32 caracteres. Se admiten las claves existentes `INSTAGRAM_ENCRYPTION_KEY` o `MAIL_ENCRYPTION_KEY` si cumplen esa longitud. No cambiar una clave tras guardar credenciales sin volver a conectar.
4. Para usar la alternativa en ventana web: registrar exactamente `https://DOMINIO-DEL-BACKEND/api/tiktok/callback` en Login Kit, guardar esa misma URL en las opciones avanzadas de Credenciales y elegir autorización en ventana web desde Cuenta. Solo esta alternativa necesita que el navegador pueda volver al backend por HTTPS. La autorización ocurre en TikTok; el panel no pide la contraseña personal.

No se puede completar una autorización real sin la app y el consentimiento de su titular. Las pruebas del repositorio simulan las respuestas oficiales; no usan cuentas ni secretos reales.

## Rutas, almacenamiento y reproducción

`/api/admin/tiktok-settings` (GET/PUT) y sus acciones `/authorize`, `/qr`, `/qr/check`, `/qr/cancel`, `/sync`, `/disconnect` requieren `settings:tiktok`. El sondeo QR tiene un límite separado de 30 peticiones por minuto para no agotar las acciones de configuración. GET `/feed` y POST `/refresh-feed` en ese montaje requieren `appearance:view` y nunca entregan credenciales. `/api/tiktok/feed` solo entrega videos aprobados por la apariencia publicada; filtra después de leer la caché. El arranque valida que el montaje de medios esté completo.

`TiktokSettings` guarda el secreto, el token y el refresh token con AES-256-GCM, fuera de SiteSettings. Las respuestas usan una lista explícita de campos. OAuth valida estado de diez minutos, un solo uso y cookie HttpOnly/Secure del navegador. Los cambios llevan revisión y concurrencia optimista. Se renuevan los tokens antes de caducar al consultar los medios; ambos tokens nuevos se guardan. Desconectar borra credenciales de cuenta, páginas y revoca el acceso remoto cuando el proveedor responde.

El QR usa los endpoints oficiales v2 `oauth/get_qrcode` y `oauth/check_qrcode`. El backend genera un `client_ticket` aleatorio, lo introduce en el enlace `aweme://authorize` y genera el PNG con la dependencia `qrcode` ya instalada. El token del proveedor, ticket, estado y sesión administrativa se guardan cifrados; el navegador solo recibe PNG, identificador opaco del flujo y caducidad máxima local de diez minutos (TikTok puede caducar el QR antes). El sondeo se hace cada tres segundos, valida ticket en las respuestas escaneadas/confirmadas y estado si viene informado. Se consume el flujo con una operación atómica y control de versión antes de intercambiar el código. Se comprueban perfil y acceso a videos antes de instalar credenciales. No se pierde una cuenta ya conectada si falla la nueva autorización.

La documentación de TikTok muestra tanto `redirect_uri` con código como el campo `code`. Se extrae el código de esa respuesta validada y se envía a `oauth/token`; si viene una URI se conserva su base para el intercambio. Nunca se visita esa URL ni se inventa un dominio público. Si solo se devuelve un código se usa la URI configurada cuando existe y se omite cuando no se solicitó ninguna. Este caso debe validarse con la app real: las pruebas simulan ambas formas documentadas y no sustituyen la autorización del titular ni los requisitos de registro de TikTok.

Cancelar, regenerar, cambiar credenciales, iniciar OAuth web o desconectar invalida el QR anterior. La sesión propietaria es obligatoria para consultar/cancelar. Una desconexión o modificación concurrente impide instalar posteriormente un resultado atrasado. El panel detiene el sondeo al salir; los errores y QR vencidos permiten generar uno nuevo. Los errores del proveedor se traducen a mensajes controlados.

La API v2 se consulta únicamente en `open.tiktokapis.com`. Se leen páginas de 20 videos públicos, con cursor firmado ligado a la conexión. No se siguen enlaces arbitrarios del proveedor. Las portadas caducan a las seis horas: caché fresca de una hora, reutilización máxima de cinco horas y TTL de cinco horas. Los errores del proveedor se traducen sin exponer su contenido ni tokens. Las decisiones de visibilidad/orden se guardan por ID estable de video y cuenta. La publicación principal de una página posterior se carga antes de mostrar una diferente.

El permiso básico entrega nombre y avatar. Cuando el enlace público de un video contiene el usuario, se usa para resolver el perfil; también puede introducirse el enlace desde Apariencia. No se solicitan estadísticas ni permisos de publicación.

Display API no proporciona el archivo de video para reproducción directa. Se usa el iframe oficial `https://www.tiktok.com/player/v1/ID` después de una acción del visitante. Los controles llaman la API postMessage oficial para reproducir, pausar, avanzar y silenciar. Los mensajes se validan por origen, ventana de iframe y marcador. Cada video conserva su propio enlace. Videos propios opcionales usan HTML video. Se pausa al salir de pantalla/ocultar la pestaña. No se modifican contadores ni cuentas de visitantes.

Referencias: [Display API](https://developers.tiktok.com/doc/display-api-get-started), [Login Kit QR](https://developers.tiktok.com/docs/en/login-kit-qr-code-authorization), [Login Kit Web](https://developers.tiktok.com/doc/login-kit-web), [Token management](https://developers.tiktok.com/doc/oauth-user-access-token-management), [List videos](https://developers.tiktok.com/doc/tiktok-api-v2-video-list), [Embed player](https://developers.tiktok.com/doc/embed-player).

## Verificación

`node --test backend/test/tiktok.test.js backend/test/tiktokQr.test.js`

`cd frontend && npx vitest run src/components/tiktok/tiktok.test.jsx src/admin/configuracion/sections/tiktok/TiktokQrConnection.test.jsx --maxWorkers=1`

`cd frontend && VITE_API_BASE_URL=https://api.example.test npm run build`

La comprobación ampliada `adminStorefrontPreviewIsolation.test.js` mantiene cuatro fallos anteriores en Categorías, Complementos, Instagram y Looks: exige el marcador de vista previa dentro de cada editor, aunque ahora la vista real se monta en `StorefrontSectionPreview`. Esos cuatro archivos no se modifican en este cambio. La vista real de TikTok y sus controles se verifican con una prueba funcional independiente.
