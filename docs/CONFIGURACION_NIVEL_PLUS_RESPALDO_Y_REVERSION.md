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

Usar preferentemente el mecanismo administrado de instantáneas y recuperación puntual del proveedor MongoDB, si está disponible, y ensayar la restauración en un entorno aislado. Documentar el punto de recuperación. Si se utiliza MongoDB Database Tools para una sola base, acordar una ventana sin escrituras de backend, trabajadores, webhooks ni otros clientes: un `mongodump` limitado a una base **sin** `--oplog` no garantiza un instante consistente si recibe escrituras durante la copia. La estrategia para webhooks y pagos que lleguen durante la ventana debe estar definida antes de detener servicios.

Plantilla **PowerShell para ejecutar en el futuro** en una máquina autorizada con `mongodump` y `mongorestore` instalados. `BACKUP_MONGODB_URI` y `STAGING_MONGODB_URI` se entregan por el gestor de secretos del entorno; no se imprimen. El backend toma primero `MONGO_URI` si existe y después `MONGODB_URI`: confirmar que `BACKUP_MONGODB_URI` apunta exactamente al origen que usa el backend y que `BACKUP_DB_NAME` es su base. La carpeta de salida está fuera del repositorio, con acceso restringido y cifrado según la política operativa.

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

Documento preparado en la rama. **Pendiente para el día de activación:** identificar infraestructura y proveedor reales, elegir mecanismo de snapshot o ventana sin escrituras, ejecutar respaldo y restauración de ensayo, registrar versiones y aprobar una decisión de reversión si hace falta. Nada de eso se ha ejecutado al redactar esta guía.

Referencias de MongoDB Database Tools: [mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) y [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/).
