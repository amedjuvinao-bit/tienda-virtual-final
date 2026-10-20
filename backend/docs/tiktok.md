# TikTok: escenario de videos y cuenta conectada

El diseño de tres columnas muestra identidad y textos, un video vertical principal y una lista lateral con selección individual. El fondo floral de satén reutiliza el recurso de Instagram. Todos los textos son editables y no hay nombres comerciales fijos. En móvil se apilan las tres áreas. La implementación anterior se conserva con `config.stageLayout = 'legacy'`.

## Administración

- Configuración → TikTok: cuenta, credenciales y ayuda. Se guardan Client Key, Client Secret, URL HTTPS permanente del backend y permiso de publicación. El secreto vacío conserva el existente. Hay controles de guardar, conectar, comprobar estado, sincronizar y desconectar.
- Apariencia → TikTok → Contenido: cuenta/manual, identidad, textos y videos. Cada video puede ocultarse, mostrarse, marcarse como principal y ordenarse manualmente. Los títulos de videos conectados admiten un reemplazo local sin editar TikTok. La aprobación de nuevos videos puede ser automática o manual.
- Apariencia → TikTok → Diseño: fondo, distribución, tipografía, colores, cristal, animaciones, móvil y visibilidad. La vista previa comparte el feed privado, incluida la selección aún no publicada.

## Conectar la cuenta

1. Configurar una app en TikTok for Developers con Login Kit (Web) y Display API. Autorizar `user.info.basic` y `video.list`. TikTok debe aprobar los productos/permisos o permitir la cuenta en el entorno de prueba.
2. Registrar exactamente `https://DOMINIO-DEL-BACKEND/api/tiktok/callback` en Login Kit. Se requiere dominio HTTPS estable; no se crea un túnel temporal ni se publica hosting desde este cambio.
3. El backend necesita `TIKTOK_ENCRYPTION_KEY` de al menos 32 caracteres. Se admiten las claves existentes `INSTAGRAM_ENCRYPTION_KEY` o `MAIL_ENCRYPTION_KEY` si cumplen esa longitud. No cambiar una clave tras guardar credenciales sin volver a conectar.
4. Guardar los datos en el panel y pulsar Conectar con TikTok. La autorización ocurre en TikTok; el panel no pide la contraseña personal.

No se puede completar una autorización real sin la app y el consentimiento de su titular. Las pruebas del repositorio simulan las respuestas oficiales; no usan cuentas ni secretos reales.

## Rutas, almacenamiento y reproducción

`/api/admin/tiktok-settings` (GET/PUT) y sus acciones `/authorize`, `/sync`, `/disconnect` requieren `settings:tiktok`. GET `/feed` y POST `/refresh-feed` en ese montaje requieren `appearance:view` y nunca entregan credenciales. `/api/tiktok/feed` solo entrega videos aprobados por la apariencia publicada; filtra después de leer la caché. El arranque valida que el montaje de medios esté completo.

`TiktokSettings` guarda el secreto, el token y el refresh token con AES-256-GCM, fuera de SiteSettings. Las respuestas usan una lista explícita de campos. OAuth valida estado de diez minutos, un solo uso y cookie HttpOnly/Secure del navegador. Los cambios llevan revisión y concurrencia optimista. Se renuevan los tokens antes de caducar al consultar los medios; ambos tokens nuevos se guardan. Desconectar borra credenciales de cuenta, páginas y revoca el acceso remoto cuando el proveedor responde.

La API v2 se consulta únicamente en `open.tiktokapis.com`. Se leen páginas de 20 videos públicos, con cursor firmado ligado a la conexión. No se siguen enlaces arbitrarios del proveedor. Las portadas caducan a las seis horas: caché fresca de una hora, reutilización máxima de cinco horas y TTL de cinco horas. Los errores del proveedor se traducen sin exponer su contenido ni tokens. Las decisiones de visibilidad/orden se guardan por ID estable de video y cuenta. La publicación principal de una página posterior se carga antes de mostrar una diferente.

El permiso básico entrega nombre y avatar. Cuando el enlace público de un video contiene el usuario, se usa para resolver el perfil; también puede introducirse el enlace desde Apariencia. No se solicitan estadísticas ni permisos de publicación.

Display API no proporciona el archivo de video para reproducción directa. Se usa el iframe oficial `https://www.tiktok.com/player/v1/ID` después de una acción del visitante. Los controles llaman la API postMessage oficial para reproducir, pausar, avanzar y silenciar. Los mensajes se validan por origen, ventana de iframe y marcador. Cada video conserva su propio enlace. Videos propios opcionales usan HTML video. Se pausa al salir de pantalla/ocultar la pestaña. No se modifican contadores ni cuentas de visitantes.

Referencias: [Display API](https://developers.tiktok.com/doc/display-api-get-started), [Login Kit Web](https://developers.tiktok.com/doc/login-kit-web), [Token management](https://developers.tiktok.com/doc/oauth-user-access-token-management), [List videos](https://developers.tiktok.com/doc/tiktok-api-v2-video-list), [Embed player](https://developers.tiktok.com/doc/embed-player).

## Verificación

`node --test backend/test/tiktok.test.js`

`cd frontend && npx vitest run src/components/tiktok/tiktok.test.jsx`

`cd frontend && VITE_API_BASE_URL=https://api.example.test npm run build`

La comprobación ampliada `adminStorefrontPreviewIsolation.test.js` mantiene cuatro fallos anteriores en Categorías, Complementos, Instagram y Looks: exige el marcador de vista previa dentro de cada editor, aunque ahora la vista real se monta en `StorefrontSectionPreview`. Esos cuatro archivos no se modifican en este cambio. La vista real de TikTok y sus controles se verifican con una prueba funcional independiente.
