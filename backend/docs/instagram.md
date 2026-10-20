# Instagram de la tienda

La integración lee una cuenta profesional (empresa o creador) mediante **Instagram API con Instagram Login**, permiso `instagram_business_basic`. No pide la contraseña de Instagram ni publica contenido. La autorización real y las aprobaciones de Meta deben completarse con la cuenta de la tienda.

## Configuración

1. Actualiza y reinicia backend y frontend.
2. Configura una clave estable de al menos 32 caracteres en `INSTAGRAM_ENCRYPTION_KEY` dentro del `.env` privado del backend. Puede generarse con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Si ya existe `MAIL_ENCRYPTION_KEY` con esa longitud se usa como alternativa. Nunca publiques la clave ni la cambies después de guardar tokens: los datos cifrados anteriores dejarían de abrirse.
3. En **Ajustes → Instagram → Credenciales**, guarda el Instagram App ID, Instagram App Secret y la URL HTTPS del backend terminada en `/api/instagram/callback`. Registra exactamente esa URL en la app de Meta. El backend debe ser accesible desde el navegador que realiza la autorización.
4. Usa **Cuenta → Conectar con Instagram** y autoriza la cuenta profesional. El modo de desarrollo de Meta puede requerir que la cuenta tenga un rol permitido en la app. Para otros usuarios completa los requisitos de acceso y revisión indicados por Meta.
5. Como alternativa, conecta un token generado por la app de Meta en el desplegable de Credenciales. Debe ser un token de **Instagram Login**, con acceso a la cuenta y permiso básico. Se verifica antes de reemplazar la conexión actual. Este método no conoce la fecha de vencimiento del token; hay que reconectarlo cuando caduque o sea revocado.
6. En **Apariencia → Instagram → Contenido → Perfil → Cuenta**, elige **Cuenta de Instagram conectada**. Decide si usar la identidad, foto de perfil y estadísticas de la cuenta; guarda Apariencia. El diseño y las fotos manuales se conservan.

## Seleccionar publicaciones desde Apariencia

En **Contenido → Publicaciones**, elige **Publicaciones de la cuenta de Instagram**. El editor muestra fotos, álbumes y reels de la cuenta, con texto, fecha, enlace original y un control **Visible/Oculta en tienda** por publicación. Puedes buscar entre las cargadas, filtrar visibles/ocultas/reels, aplicar mostrar u ocultar al resultado y cargar más páginas. El listado presenta doce tarjetas por página para mantener corto el editor.

Las decisiones se guardan por identificador de publicación y cuenta dentro de la configuración de Apariencia. Cambian la vista previa al instante y se publican con **Guardar cambios**; actualizar o cargar más contenido no publica el borrador. Las fotografías manuales se conservan al alternar de origen.

**Al recibir publicaciones nuevas** permite mostrarlas automáticamente (respetando las ocultas) o esperar selección. Al pasar a selección se conservan las publicaciones cargadas que ya eran visibles; las nuevas o aún no cargadas esperan aprobación. En selección, una lista vacía deja la sección sin publicaciones visibles.

El feed público aplica la selección publicada en cada lectura, después de recuperar la caché y también al paginar. Salta páginas totalmente ocultas con un límite de ocho páginas y un presupuesto de ocho segundos entre páginas; si quedan resultados, devuelve un cursor para continuar. Las rutas `/api/admin/instagram-settings/feed` y `/api/admin/instagram-settings/refresh-feed` requieren autenticación y permiso `appearance:view`; permiten consultar las ocultas para editar sin acceder a las credenciales privadas. El editor y su vista previa comparten el feed administrativo para mostrar cambios aún no publicados y selecciones de páginas posteriores.

## Comportamiento

- Feed paginado de 12 publicaciones por petición. “Cargar más publicaciones” recorre las páginas disponibles en la API, sin aplicar el límite de la selección manual ni prometer publicaciones que Meta no exponga.
- Cada publicación conserva su enlace; los álbumes abren una vista completa con navegación. Los videos se reproducen cuando Meta proporciona el archivo. Medios sin imagen accesible o sin enlace válido se omiten.
- Me gusta y comentarios abren la publicación en Instagram. Compartir utiliza el enlace de esa publicación. Las fotos manuales sin enlace se comparten con un enlace local a la foto. Guardadas se almacena solo en el navegador del visitante.
- Perfil y páginas consultadas se actualizan al visitarlas, con caché de una hora. El botón **Actualizar ahora** fuerza la actualización del perfil y primera página. Las siguientes páginas se actualizan al consultarlas. Los tokens de larga duración obtenidos por OAuth se intentan renovar en una consulta cuando faltan menos de siete días y tienen al menos 24 horas. Si la tienda permanece sin visitas hasta que caduquen, será necesario reconectar.
- Un fallo temporal permite usar la última página en caché, marcada como antigua, mientras siga disponible (máximo 24 horas). La selección manual sirve de respaldo cuando no se puede cargar la cuenta. Una cuenta conectada sin publicaciones no se sustituye por publicaciones inventadas.
- Desconectar elimina el token y las páginas de esa conexión de la tienda; no borra las fotos manuales ni cambia los permisos de la cuenta en Meta. Para retirar también el consentimiento, revoca la app desde Instagram.

## Protección y operación

`InstagramSettings` almacena token y secreto con AES-256-GCM y fuera de `SiteSettings/theme`. El panel solo recibe indicadores de credenciales guardadas. La gestión requiere `settings:instagram` (o acceso de administrador/propietario). Los secretos se ocultan en auditoría y nunca se devuelven en el feed público. OAuth usa estado de diez minutos, un solo uso y cookie HttpOnly del navegador. La paginación pública usa cursores firmados; el servidor nunca sigue la URL `paging.next` suministrada por el proveedor.

Graph API está fijada inicialmente en `v24.0`; puede actualizarse en Credenciales cuando sea necesario. Las colecciones `InstagramSettings` e `InstagramFeedPage` necesitan los índices declarados en sus modelos, incluidos unicidad por página y TTL del caché. Aplica el procedimiento habitual de índices del proyecto cuando estén desactivados los índices automáticos.

Pruebas: `node --test backend/test/instagram.test.js` desde la raíz. La suite usa respuestas controladas de Meta; no reemplaza una prueba de autorización con la app y cuenta reales.

Documentación oficial: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login

### Índices de producción

Con la conexión MongoDB del backend configurada, revisa primero `node backend/scripts/migrateInstagramIndexes.js` (solo muestra el plan). Para crear los índices sin eliminar otros: `node backend/scripts/migrateInstagramIndexes.js --apply-instagram-index-migration`. En producción añade `--confirm-production-instagram-index-migration`, siguiendo la política de migraciones del proyecto. En desarrollo se crean automáticamente.

La consulta de Apariencia usa el mismo montaje administrativo de la conexión: GET `/api/admin/instagram-settings/feed` y POST `/api/admin/instagram-settings/refresh-feed`. Ambas exigen `appearance:view`; las credenciales siguen reservadas a `settings:instagram`. Las direcciones anteriores se conservan como alias protegidos. El editor espera hasta 45 segundos para permitir las consultas de perfil y medios y distingue errores de ruta, sesión, permisos, tiempo de espera y respuestas inválidas.
