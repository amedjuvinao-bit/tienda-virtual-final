# Usuarios Nivel Plus — paso 1: separación de permisos

## Alcance

La política de escritura administrativa aplica las mismas reglas en el mapa global de rutas y en la ruta de Usuarios:

| Operación | Permiso exigido |
| --- | --- |
| Crear usuario con perfil | `admin-users:create` y `admin-users:assign_role` |
| Editar datos del usuario | `admin-users:update` |
| Cambiar perfil o sedes desde edición | `admin-users:update` y `admin-users:assign_role` |
| Cambiar estado desde edición | `admin-users:update` y `admin-users:disable` |
| Activar o desactivar desde acción independiente | `admin-users:disable` |
| Restablecer contraseña | `admin-users:password` |
| Cambiar obligación de contraseña desde edición | `admin-users:update` y `admin-users:password` |
| Administrar 2FA | Se mantiene la reautenticación exclusiva del propietario. |

El backend valida la autoridad independientemente de los controles de la interfaz. Un perfil no propietario no puede asignar `owner`; los perfiles limitados tampoco pueden asignar perfiles superiores a su nivel, alcance o permisos efectivos. El acceso a usuarios se limita a las sedes del actor; los usuarios compartidos entre sedes solo pueden ser modificados por una cuenta con alcance sobre todas ellas. Los permisos individuales enviados en el cuerpo se rechazan, porque la autorización de las cuentas con perfil se resuelve desde el perfil activo.

Los cambios de estado hechos desde el formulario invalidan sesiones igual que la acción dedicada. El mapa global registra los cambios de estado y conserva la auditoría existente de altas, ediciones, contraseñas y bajas. El formulario omite los campos que no se modificaron, de modo que una edición de datos no reenvíe perfiles, estado ni sedes múltiples.

## Verificación

```bash
npm --prefix backend run test:admin-users-stage1
npm --prefix frontend run test:admin-users-stage1
npm --prefix backend run test:admin-auth-security
npm --prefix backend run test:admin-session-security
npm --prefix backend run test:configuration-level-plus-stage0
npm --prefix frontend run test:configuration-level-plus-stage0
npm --prefix frontend run build
```

Las pruebas específicas cubren permisos del mapa global y de la ruta, intento de asignar un perfil superior, alcance por sede, acciones de una cuenta de solo lectura, edición limitada y preservación de sedes al editar otros datos. La prueba de 2FA del propietario se ejecuta con la del frontend. La prueba de acceso por HTTP con MongoDB aislada y la revisión visual con distintos perfiles forman parte del cierre integral; no se reemplazan con estos contratos locales.

## Siguiente paso

Completar el formulario y listado de Usuarios con varias sedes, búsqueda y paginación del servidor y controles de estados. Esta etapa todavía no es un cierre de producción de Usuarios, Perfiles, Sedes ni Logs.
