# Publicación de Rosa Boutique en Render

## Configuración preparada

| Componente | Publicación |
| --- | --- |
| React y panel administrativo | Sitio estático de Render, `frontend/dist` |
| Node.js, Express y tareas existentes | Una instancia Docker en Render |
| Datos | MongoDB Atlas, con soporte de transacciones |
| Imágenes nuevas | Cloudinary, con la configuración existente |
| Respaldos cifrados e imágenes locales heredadas | Disco persistente `/var/data` |
| Dominio y correo empresarial | Servicios externos que se conectan al publicar |

`render.yaml` propone región Virginia, instancia Starter y disco de 5 GB. Son
valores iniciales para revisar antes de contratar. La memoria y el disco deben
dimensionarse con el catálogo, el tamaño del respaldo y el uso esperado; esta
plantilla no constituye una prueba de capacidad ni de alta disponibilidad.
Elegir una región de Atlas cercana a la del backend.

No se ha contratado ni activado ningún servicio con estos archivos. La creación
del Blueprint en Render sí puede generar cargos por servidor y almacenamiento.

## Archivos de publicación

- `deploy/backend.Dockerfile`: Node 24 LTS fijado por digest, dependencias de
  producción desde el lockfile y MongoDB Database Tools 100.20.1 con SHA-256.
- `.dockerignore`: permite únicamente los archivos necesarios para el backend;
  excluye `.env`, dependencias locales, pruebas y respaldos.
- `deploy/backend-entrypoint.sh`: prepara el disco, conserva las imágenes locales
  heredadas sin sobrescribir archivos existentes y ejecuta Node como uid 1000.
- `deploy/build-frontend.mjs`: exige el origen HTTPS de acceso a la API, compila ambas
  entradas y retira únicamente del artefacto comercial las políticas antiguas de
  desarrollo de `public/legal`. Esos originales permanecen en el repositorio.
- `.github/workflows/deployment-ci.yml`: valida el Blueprint oficial, compila el
  frontend y prueba la imagen con dos MongoDB desechables. No publica imágenes,
  no usa credenciales de negocio y no crea servicios de pago.

Ambos servicios se construyen desde la raíz del repositorio. No establecer
`rootDir: backend` ni `rootDir: frontend`: ambos necesitan `shared/`.

## 1. Validar la preparación

```bash
node --test backend/test/deploymentRuntime.test.js deploy/build-frontend.test.mjs
docker build --file deploy/backend.Dockerfile --tag tienda-backend:local .
bash deploy/smoke-backend.sh tienda-backend:local
```

La prueba Docker se ejecuta en Linux/amd64 y crea sus propias bases, red,
contraseñas temporales y disco. Prueba arranque en modo producción, respuesta de
productos, permisos del proceso, exclusión de secretos, copia cifrada, restauración
en otro servidor, persistencia después de reiniciar, mantenimiento, caída de MongoDB y cierre
ordenado. Elimina únicamente los recursos temporales que ella misma creó.
En Windows puede ejecutarse en WSL con Docker; también se ejecuta en GitHub Actions.

El frontend de CI usa `https://api.example.com`, un origen de ejemplo. No publicar
ese artefacto: Render lo reconstruye con la URL real introducida en su panel.

## 2. Crear las cuentas y fijar el dominio

1. Crear la cuenta de Render y conectar el repositorio de GitHub del propietario.
2. Elegir un dominio disponible y registrarlo en una cuenta del propietario.
3. Prever el frontend y el backend bajo el mismo dominio, por ejemplo
   `www.tudominio.com` y `api.tudominio.com`.
4. Elegir el buzón empresarial y el proveedor de envío automático. Se conserva
   el módulo SMTP existente. En Render de pago usar SMTP 465 o 587; no puerto 25.

El navegador accede a la API a través de `/api/*` en la misma dirección de la
tienda. Render reenvía esas peticiones al backend existente; `/uploads/*` conserva
el acceso a sus imágenes heredadas. Las reglas son reescrituras, no redirecciones,
y preceden al fallback de React. Las respuestas de `/api/*` se marcan
`Cache-Control: private, no-store` para no compartir datos de sesiones en la CDN.
Así las cookies administrativas son de primera parte también en Safari, sin
pedir que se desactiven las protecciones del navegador ni guardar JWT en JavaScript.

En el primer despliegue, el Blueprint obtiene automáticamente `FRONTEND_URL`,
`BACKEND_URL` y `VITE_API_BASE_URL` de la variable `RENDER_EXTERNAL_URL` mediante
`fromService`: `FRONTEND_URL` y `VITE_API_BASE_URL` apuntan a `rosa-boutique-web` y
`BACKEND_URL` apunta a `rosa-boutique-api`. No es necesario adivinar los
subdominios ni copiar los túneles de desarrollo. La referencia usa la dirección
pública HTTPS, no el nombre de la red privada de Render.

Los destinos de las reescrituras usan la URL pública del backend ya creado,
`https://rosa-boutique-api.onrender.com`. Si se reutiliza esta plantilla para
otros servicios, comprobar y sustituir ambos destinos: Render no interpola
variables en las reglas.

Al conectar el dominio propio, establecer `FRONTEND_URL` y `VITE_API_BASE_URL`
en ese mismo origen público y mantener `/api/*` apuntando al backend. Actualizar
también `BACKEND_URL` si cambia su URL pública. Una edición únicamente en el
panel puede ser reemplazada por el Blueprint en una futura sincronización.

## 3. Preparar MongoDB, claves e integraciones

Las variables `sync: false` del Blueprint se introducen privadamente en Render.
No pegarlas en el repositorio, una incidencia, el chat ni una captura de pantalla.

| Grupo | Configuración |
| --- | --- |
| Base de datos | `MONGO_URI` |
| Direcciones automáticas | `FRONTEND_URL` y `BACKEND_URL`, mediante referencias a los servicios de Render |
| Sesiones y accesos | `JWT_SECRET`, `CART_ACCESS_SECRET`, `ORDER_PAYMENT_ACCESS_SECRET`, `ORDER_RETURN_ACCESS_SECRET` |
| Cifrado de configuraciones | `BILLING_ENCRYPTION_KEY`, `INTEGRATIONS_ENCRYPTION_KEY`, `MAIL_ENCRYPTION_KEY`, `ADMIN_2FA_ENCRYPTION_KEY`, `INSTAGRAM_ENCRYPTION_KEY` |
| Auditoría | `CUSTOMER_AUDIT_HASH_SECRET` |
| Imágenes | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Respaldos | `BACKUP_DB_NAME`, `BACKUP_ENCRYPTION_KEY`, `STAGING_MONGODB_URI` |
| Frontend | `VITE_API_BASE_URL`, asignada al origen HTTPS de la tienda, sin `/api`; Render reenvía `/api/*` al backend |

Si se migra una base existente, conservar las claves efectivas con las que se
cifraron configuraciones, secretos TOTP y registros de auditoría. Para una clave
que antes usaba un respaldo de otra variable, trasladar ese mismo valor efectivo.
No generar claves nuevas sobre esos datos: impediría descifrarlos o verificar
historiales. Guardar una copia de recuperación de las claves fuera de Render.

`BACKUP_DB_NAME` debe coincidir con la base incluida en `MONGO_URI`.
`BACKUP_ENCRYPTION_KEY` requiere 64 caracteres hexadecimales. El clúster de
`STAGING_MONGODB_URI` debe ser **otro servidor**, exclusivo para restauraciones de
prueba; no usar allí la base operativa ni otro clúster de producción.

Atlas requiere un usuario de aplicación con permisos limitados y acceso de red
para las IP de salida del servicio Render. Comprobar las migraciones de índices
necesarias antes de admitir pedidos: producción tiene `autoIndex` desactivado.
No ejecutar seeds ni comandos de borrado contra la base comercial. Las pruebas
Docker no sustituyen esa verificación de índices de la base real.

Las cookies mantienen `HttpOnly` y `Secure` y no llevan un dominio compartido.
El valor existente `ADMIN_COOKIE_SAME_SITE=none` es compatible con las peticiones
de primera parte a través de la reescritura; no necesita cambiarse para este
ajuste. `lax` también es válido cuando todos los accesos del navegador a la API
pasan por la misma dirección de la tienda. No volver a apuntar el frontend
directamente a otro sitio: Safari puede bloquear esas cookies aunque usen `none`.

Revisar en el panel los destinos de Wompi, Factus, correo e integraciones de envío
con las URLs definitivas. Las credenciales de producción deben pertenecer a sus
cuentas reales; esta preparación no las activa ni ejecuta cobros o facturas.

## 4. Crear los servicios

1. Integrar la preparación revisada en `main` después del CI.
2. En Render, crear un Blueprint desde ese repositorio y `render.yaml`.
3. Revisar el presupuesto de servidor, disco y cualquier otro servicio antes de
   confirmar su creación. Atlas, correo y dominio tienen facturación separada.
4. Introducir los valores privados. El Blueprint resuelve las tres direcciones
   HTTPS públicas automáticamente; no introducir túneles `trycloudflare.com` ni
   direcciones `localhost`. El nombre del servicio no garantiza que su subdominio
   `.onrender.com` coincida exactamente.
5. Conectar los dominios siguiendo los registros DNS que muestre Render. Mantener
   los registros del correo y autenticar al proveedor de envío.
6. Verificar HTTPS, la página pública y el acceso administrativo con 2FA.

Después de aplicar las reescrituras, comprobar que `/api/admin/auth/verify` en
la dirección de la tienda devuelve JSON del backend y no `index.html`, que las
respuestas de autenticación no se almacenan en caché y que las cookies
`Set-Cookie` conservan `HttpOnly`, `Secure` y sus rutas. Validar en Safari el
inicio de sesión, recarga, navegación y cierre de sesión; estas comprobaciones
del entorno real no quedan sustituidas por el build local.

El frontend conserva el acceso directo a sus rutas mediante la reescritura a
`index.html`. `/legal/privacidad.html` y `/legal/terminos.html` redirigen a las
páginas comerciales actuales. La vista previa mantiene `page-preview.html`.

## 5. Operación, respaldos y actualizaciones

- Render comprueba `/healthz`. El endpoint consulta MongoDB con un plazo de dos
  segundos y devuelve solamente `{ "ok": true/false }`. No muestra credenciales
  ni diagnósticos internos. Una pausa por respaldo no provoca por sí sola el
  reinicio del proceso.
- El cierre por SIGTERM deja hasta 25 segundos para terminar solicitudes y
  tareas en curso antes de cerrar MongoDB. Render aplica un plazo fijo de
  30 segundos a los servicios con disco y no permite personalizarlo mediante
  `maxShutdownDelaySeconds`; ese campo debe permanecer ausente del Blueprint.
- Los trabajos existentes siguen dentro de una única instancia. No agregar
  otro backend o worker escritor sin revisar la coordinación de respaldos.
- `BACKUP_PANEL_SINGLE_INSTANCE` permanece `false` hasta confirmar que se ha
  detenido el backend local y cualquier otro escritor externo de esa misma base.
  Entonces puede establecerse `true` para usar el respaldo desde el panel.
- El botón existente pausa la tienda, genera la copia cifrada y comprueba una
  restauración. Programar su ejecución operacional según el volumen de ventas;
  este despliegue no añade una tarea nocturna ni modifica el módulo de respaldo.
- Descargar y conservar una copia cifrada fuera del proveedor. El disco
  persistente no sustituye una copia externa ni las claves de recuperación.
- Con disco persistente, los despliegues del backend tienen una interrupción
  breve. Esta configuración no ofrece publicación sin interrupciones ni múltiples
  réplicas. Una ampliación de alta disponibilidad requiere otro diseño de respaldo.
- `checksPass` retrasa actualizaciones automáticas hasta que pasan los checks de
  GitHub. Para corregir una versión, preferir revertir el commit y publicar la
  corrección comprobada. Si se cambia manualmente de versión en Render, coordinar
  también el frontend y revisar compatibilidad de datos e índices: volver al
  código anterior no revierte escrituras ni migraciones de MongoDB.

## Comprobación final de la instalación real

Una vez conectadas las cuentas: verificar entrada pública y panel, carga de una
imagen, envío de un correo, recepción de PQR/notificación y los callbacks de las
integraciones configuradas. Confirmar el respaldo y su restauración con la base
correcta, revisar datos del negocio y proveedores en las políticas, y habilitar
ventas reales después de esas comprobaciones. Son pruebas de la instalación
externa, diferentes de repetir los módulos ya aprobados.

Referencias: [Docker en Render](https://render.com/docs/docker),
[Blueprint](https://render.com/docs/blueprint-spec),
[discos](https://render.com/docs/disks),
[despliegues tras CI](https://render.com/docs/deploys),
[MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/installation/).
