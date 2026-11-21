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
- `deploy/build-frontend.mjs`: exige la URL HTTPS del backend, compila ambas
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

Las direcciones `.onrender.com` pueden servir para una comprobación inicial. Para
la operación administrativa se recomienda el dominio propio compartido: algunos
navegadores bloquean las cookies entre sitios distintos aunque usen `SameSite=None`.

## 3. Preparar MongoDB, claves e integraciones

Las variables `sync: false` del Blueprint se introducen privadamente en Render.
No pegarlas en el repositorio, una incidencia, el chat ni una captura de pantalla.

| Grupo | Configuración |
| --- | --- |
| Datos y direcciones | `MONGO_URI`, `FRONTEND_URL`, `BACKEND_URL` |
| Sesiones y accesos | `JWT_SECRET`, `CART_ACCESS_SECRET`, `ORDER_PAYMENT_ACCESS_SECRET`, `ORDER_RETURN_ACCESS_SECRET` |
| Cifrado de configuraciones | `BILLING_ENCRYPTION_KEY`, `INTEGRATIONS_ENCRYPTION_KEY`, `MAIL_ENCRYPTION_KEY`, `ADMIN_2FA_ENCRYPTION_KEY`, `INSTAGRAM_ENCRYPTION_KEY` |
| Auditoría | `CUSTOMER_AUDIT_HASH_SECRET` |
| Imágenes | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Respaldos | `BACKUP_DB_NAME`, `BACKUP_ENCRYPTION_KEY`, `STAGING_MONGODB_URI` |
| Frontend | `VITE_API_BASE_URL`, origen del backend sin `/api` |

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

Con frontend y API HTTPS bajo el mismo dominio, configurar
`ADMIN_COOKIE_SAME_SITE=lax`. Si se prueban temporalmente dominios distintos, usar
`none`, sabiendo que el navegador puede bloquear esas cookies de terceros.

Revisar en el panel los destinos de Wompi, Factus, correo e integraciones de envío
con las URLs definitivas. Las credenciales de producción deben pertenecer a sus
cuentas reales; esta preparación no las activa ni ejecuta cobros o facturas.

## 4. Crear los servicios

1. Integrar la preparación revisada en `main` después del CI.
2. En Render, crear un Blueprint desde ese repositorio y `render.yaml`.
3. Revisar el presupuesto de servidor, disco y cualquier otro servicio antes de
   confirmar su creación. Atlas, correo y dominio tienen facturación separada.
4. Introducir los valores privados, usando las URLs HTTPS reales. El nombre del
   servicio no garantiza que su subdominio `.onrender.com` coincida exactamente.
5. Conectar los dominios siguiendo los registros DNS que muestre Render. Mantener
   los registros del correo y autenticar al proveedor de envío.
6. Verificar HTTPS, la página pública y el acceso administrativo con 2FA.

El frontend conserva el acceso directo a sus rutas mediante la reescritura a
`index.html`. `/legal/privacidad.html` y `/legal/terminos.html` redirigen a las
páginas comerciales actuales. La vista previa mantiene `page-preview.html`.

## 5. Operación, respaldos y actualizaciones

- Render comprueba `/healthz`. El endpoint consulta MongoDB con un plazo de dos
  segundos y devuelve solamente `{ "ok": true/false }`. No muestra credenciales
  ni diagnósticos internos. Una pausa por respaldo no provoca por sí sola el
  reinicio del proceso.
- El cierre por SIGTERM deja hasta 110 segundos para terminar solicitudes y
  tareas en curso antes de cerrar MongoDB. Render concede 120 segundos.
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
