# Preparación de respaldo y reversión — Configuración Nivel Plus

**Alcance:** PR #16, rama `feature/configuracion-sedes-nivel-plus`: Usuarios, Perfiles, Sedes y Logs. Esta guía prepara una futura integración y puesta en servicio. No ejecuta un respaldo, una restauración, un despliegue ni una integración en `main`.

## Dos momentos distintos

1. **Antes de integrar el código:** revisar el PR completo, las pruebas, las capturas del panel y la compatibilidad con la versión actual de `main`. Integrar código no cambia por sí solo la base de datos en producción.
2. **Inmediatamente antes de activar la nueva versión en producción:** registrar la versión anterior y la nueva, hacer y verificar el respaldo, confirmar cómo se detienen las escrituras y preparar la reversión. Un respaldo antiguo no reemplaza uno tomado en esta ventana.

La preparación productiva también incluye HTTPS, secretos, configuración de Factus, rangos oficiales y pasarela de pago; esos puntos tienen su propio control y no quedan aprobados por este documento.

## Datos que se deben registrar antes de una futura activación

En un registro privado de la operación, anotar la hora y responsable, entorno y base de datos, SHA o artefacto desplegado actualmente, SHA o artefacto nuevo, método y ubicación del respaldo, hash SHA-256, resultado de la restauración de ensayo y ventana de mantenimiento. **Nunca** guardar URI con credenciales, secretos, archivos de respaldo o códigos 2FA en Git, un PR o un chat.

El respaldo de MongoDB no cubre archivos externos: identificar por separado los recursos de Cloudinary y cualquier archivo en `uploads/`, además de la configuración y secretos necesarios para arrancar la versión anterior. Definir la política de copia y retención de estos recursos según el proveedor real antes de operar.

## Comprobaciones de solo lectura

Desde la raíz del repositorio y con `backend/.env` apuntando expresamente al entorno que se va a comprobar:

```powershell
git status --short --branch
git rev-parse HEAD
npm run validate:admin-access
npm run validate:role-default
npm run validate:branch-selection
```

Los tres validadores no modifican datos. Exigir `relationshipsReady: true` y `ready: true` en las otras dos salidas. Si hay bloqueos, detener la activación y resolverlos antes de cualquier migración. En producción, Mongoose deshabilita `autoIndex`; los índices de perfil predeterminado y sedes se gestionan explícitamente con `backend/scripts/migrateAdminRoleDefaultIndex.js` y `backend/scripts/migrateBranchSelectionIndexes.js`. Sus opciones `--apply` son escrituras y exigen una decisión separada, después del respaldo; no forman parte de este procedimiento preparatorio.

## Respaldo verificable en la ventana de activación

El propietario puede elegir en **Configuración → Respaldos** entre “Atlas Free · copia externa” y “Atlas de pago · copias administradas”. En Free, una vez preparado el servidor, el botón **Crear copia ahora** pausa la tienda, ejecuta la copia y el ensayo de restauración, muestra el avance y reabre al terminar. Exige contraseña y TOTP del propietario. El historial permite descargar el archivo cifrado y su registro. Elegir el método no ejecuta por sí solo la copia ni cambia el plan contratado en Atlas.

Usar preferentemente el mecanismo administrado de instantáneas y recuperación puntual del proveedor MongoDB, si está disponible, y ensayar la restauración en un entorno aislado. Documentar el punto de recuperación. Si se utiliza MongoDB Database Tools para una sola base, acordar una ventana sin escrituras de backend, trabajadores, webhooks ni otros clientes: un `mongodump` limitado a una base **sin** `--oplog` no garantiza un instante consistente si recibe escrituras durante la copia. La estrategia para webhooks y pagos que lleguen durante la ventana debe estar definida antes de detener servicios.

### Procedimiento automatizado para Atlas Free

1. Instalar MongoDB Database Tools (`mongodump` y `mongorestore`) en la máquina del backend. Configurar en `backend/.env`: `BACKUP_DB_NAME` (la base de la URI usada por el backend), `BACKUP_DIRECTORY` (ruta absoluta persistente **fuera del proyecto**, preferentemente en un volumen cifrado por el archivo temporal sin cifrar), `BACKUP_ENCRYPTION_KEY` (32 bytes aleatorios hexadecimales, conservar otra copia segura fuera del servidor) y `STAGING_MONGODB_URI` (otro clúster/servidor MongoDB, con credenciales de escritura para el ensayo). `BACKUP_MONGODB_URI` es opcional y debe apuntar al mismo clúster y la misma base que el backend; permite una credencial de lectura. La clave puede generarse localmente con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y guardarse en el gestor de secretos, nunca en Git.
2. Para permitir el botón del panel, confirmar operativamente que hay **una sola instancia** del backend, sin otros trabajadores ni clientes que escriban a esa base, y establecer `BACKUP_PANEL_SINGLE_INSTANCE=true`. Si hay varias instancias o clientes externos, usar el procedimiento de consola con todas las escrituras detenidas. Confirmar que los proveedores externos reintentan notificaciones durante la pausa y conciliar pagos y facturas después. El botón responde HTTP 503 para las demás rutas, espera a que terminen las solicitudes, auditorías y trabajadores ya activos y mantiene el bloqueo en disco si el servidor se interrumpe. Si no puede demostrar que el entorno está listo, no inicia la copia.
3. Desde **Configuración → Respaldos**, elegir y guardar Atlas Free, pulsar **Crear copia ahora** y confirmar contraseña y TOTP. La tienda se pausa y el panel muestra el avance. El proceso registra huellas SHA-256 del contenido de cada colección e índices, ejecuta `mongodump`, compara el origen antes y después, ejecuta `mongorestore` en una base nueva de otro servidor, compara contenido e índices, cifra con AES-256-GCM, comprueba descifrado y SHA-256, registra cada paso y borra el archivo temporal sin cifrar. Si falla cualquier paso, registra **fallido** y reabre la tienda tras finalizar la limpieza. Si se interrumpe el servidor, la tienda permanece pausada hasta comprobar que no sigue un proceso ni queda un temporal; con una sesión de propietario vigente se puede reabrir con contraseña y TOTP. Si expiró la sesión, un operador debe revisar el servidor y restablecer el acceso antes de reabrir.
4. Revisar el resultado en el historial y descargar **ambos** archivos (`.enc` y `.json`) a almacenamiento externo protegido. La copia en el servidor no protege frente a pérdida de ese servidor. Conservar también la clave fuera de él. Revisar que la copia descargada coincida con SHA-256 del panel y programar ensayos periódicos de recuperación.

**Alternativa sin botón:** detener todos los backend/workers y ejecutar `npm run backup:free` desde `backend/`. El comando reserva el puerto configurado y responde HTTP 503; si el backend sigue escuchando, falla sin hacer la copia. Al terminar, iniciar de nuevo el backend. Esta alternativa sirve cuando no se puede confirmar una sola instancia para el botón del panel.

El registro verificado prueba el ensayo de ese momento, no garantiza que ningún cliente externo haya escrito durante la ventana. Las huellas detectan diferencias antes/después, pero no prueban que no haya habido escrituras durante la copia que luego se revirtieron; por eso el cierre de **todas** las escrituras es obligatorio. El backup de MongoDB tampoco incluye Cloudinary, `uploads/` ni secretos. La restauración de ensayo crea una base `restore_check_<id>` en el servidor separado y la elimina tras la comprobación; si el proceso avisa que no pudo limpiarla, eliminarla manualmente.

Para comprobar una copia descargada en otra máquina, colocar la clave en `BACKUP_ENCRYPTION_KEY` y ejecutar `npm run backup:decrypt -- <ruta-al-archivo.enc> <ruta-al-registro.json> <directorio-absoluto-salida>` desde `backend/`. El archivo descifrado queda sensible: usar `mongorestore` únicamente contra un destino aislado y eliminarlo después. No restablecer una base productiva sin reconciliar operaciones posteriores a la copia.

La siguiente plantilla PowerShell es una alternativa manual para personal autorizado. Produce temporalmente un archivo **sin cifrar**, requiere todos los controles de mantenimiento y no alimenta el historial del panel:

```powershell
$databaseName = $env:BACKUP_DB_NAME
$backupDirectory = $env:BACKUP_DIRECTORY
if ([string]::IsNullOrWhiteSpace($databaseName) -or
    [string]::IsNullOrWhiteSpace($backupDirectory) -or
    [string]::IsNullOrWhiteSpace($env:BACKUP_MONGODB_URI)) {
    throw 'Faltan BACKUP_DB_NAME, BACKUP_DIRECTORY o BACKUP_MONGODB_URI.'
}
if ($databaseName -notmatch '^[A-Za-z0-9_-]+$') {
    throw 'Revisa el nombre de la base antes de continuar.'
}
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$archive = Join-Path $backupDirectory ("{0}-{1}.archive.gz" -f $databaseName, (Get-Date -Format 'yyyyMMdd-HHmmss'))
mongodump --uri $env:BACKUP_MONGODB_URI --db $databaseName --archive=$archive --gzip
if ($LASTEXITCODE -ne 0) { throw 'Falló mongodump; no continuar.' }
if ((Get-Item $archive).Length -le 0) { throw 'El archivo está vacío.' }
Get-FileHash -Algorithm SHA256 -Path $archive
```

Un archivo no vacío y un hash comprueban transferencia e integridad de bytes, **no** que la restauración sea utilizable. Verificar el archivo en otra instancia o clúster aislado y con una base de destino vacía, nunca en el origen. Elegir un nombre exclusivo de ensayo (`RESTORE_TEST_DB_NAME`) y confirmar que `STAGING_MONGODB_URI` no apunta a producción. La plantilla siguiente crea datos **solo en ese destino de ensayo**:

```powershell
$restoreDb = $env:RESTORE_TEST_DB_NAME
if ([string]::IsNullOrWhiteSpace($env:STAGING_MONGODB_URI) -or
    $restoreDb -notmatch '^restore_check_[A-Za-z0-9_-]+$' -or
    $restoreDb -eq $databaseName) {
    throw 'Configura un destino aislado y un nombre restore_check_... distinto del origen.'
}
mongorestore --uri $env:STAGING_MONGODB_URI --gzip --archive=$archive `
    --nsInclude="$databaseName.*" --nsFrom="$databaseName.*" --nsTo="$restoreDb.*"
if ($LASTEXITCODE -ne 0) { throw 'Falló la restauración de ensayo.' }
```

Comparar colecciones y recuentos principales (`adminusers`, `adminroles`, `branches`, órdenes y facturas) entre el origen en el momento de la copia y el destino aislado; verificar índices y que se puede consultar la copia. No dar por válido el respaldo si faltan colecciones, documentos o índices. Guardar el resultado y el hash en el registro privado de la operación.

## Decisión de reversión después de activar

| Situación | Acción controlada |
|---|---|
| Falla la interfaz o el backend y los datos siguen siendo compatibles con la versión anterior | Sacar la versión nueva de servicio, volver a desplegar el **artefacto/SHA anterior registrado**, validar acceso de OWNER con 2FA y recorridos básicos, y reabrir el servicio. Mantener la base actual para no perder operaciones. |
| Una migración de datos/índices impide volver al código anterior | Detener escrituras, identificar exactamente qué cambió y decidir una corrección o migración compensatoria probada en ensayo. No borrar índices ni restaurar por inercia. |
| Se plantea restaurar MongoDB | Primero preservar también el estado **actual**, identificar y conciliar todas las escrituras posteriores al respaldo (órdenes, pagos, facturas, inventario, sesiones y webhooks), probar la restauración en ensayo y obtener autorización operativa específica. Restaurar una copia anterior sin conciliación puede perder transacciones o duplicar efectos externos. |

Tras cualquiera de las rutas: comprobar los validadores de solo lectura, inicio de sesión, permisos, sede principal y web, pedidos y facturación; verificar colas y webhooks sin repetir manualmente cobros ni documentos fiscales ya confirmados. Conservar evidencia del incidente y la versión final. Un rollback de Git no revierte MongoDB ni acciones externas.

## Estado de esta guía

Código preparado en la rama. **Pendiente para el día de activación:** instalar Database Tools, configurar destino de ensayo y almacenamiento externo, parar todas las escrituras, ejecutar una copia real con restauración, custodiar clave y archivos, y probar la recuperación desde los archivos descargados. No se ha ejecutado una copia real sobre Atlas al redactar esta guía.

Referencias de MongoDB Database Tools: [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) y [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/).
