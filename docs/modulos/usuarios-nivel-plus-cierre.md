# Usuarios Nivel Plus — revisión funcional

## Recorrido del administrador

1. Buscar cuentas por nombre, usuario, correo o documento; combinar la búsqueda con estado, perfil y sede. La consulta y la paginación se resuelven en el servidor, con alcance limitado a las sedes autorizadas.
2. Consultar en cada cuenta su perfil, sede principal y otras sedes, estado de acceso y estado 2FA. El resumen cuenta únicamente las cuentas visibles en la página actual, y así lo indica.
3. Crear y editar según permisos independientes. Las asignaciones de sede conservan las capacidades existentes; el backend comprueba rol, alcance, sede principal, estado y permisos.
4. Administrar contraseña, estado y 2FA según la autoridad del actor. Un bloqueo temporal de login se elimina al reactivar una cuenta. Las salidas de propietarios activos se protegen con una guarda transaccional.
5. Consultar **Ver actividad** si se poseen `admin-users:view` y `logs:view`. Hay tres categorías: **Acciones realizadas** por la cuenta en rutas administrativas auditadas (cualquier módulo), **Cambios en la cuenta** hechos por otros o por sí misma, y **Accesos vinculados** al ID de la cuenta. Cada categoría tiene paginación de diez registros. El servidor comprueba el alcance por sede antes de leer auditoría y solo devuelve campos de presentación. Las nuevas altas registran el ID de la cuenta para que también aparezcan en el historial.

Las acciones mostradas son las operaciones protegidas que la aplicación audita; no se registran todas las consultas de lectura ni cada clic. Los accesos antiguos de `AdminLoginAudit` solo guardaron el nombre de usuario: no se atribuyen por nombre, porque el nombre puede cambiar o reasignarse. Los nuevos accesos de cuentas de base de datos sí guardan `adminUserId` cuando la identidad está verificada; los intentos anónimos o fallidos no se atribuyen como acciones del titular.

## Integraciones comprobadas

| Módulo | Conexión desde Usuarios |
| --- | --- |
| Perfiles | Los perfiles activos alimentan la asignación y el filtro; la autoridad se comprueba de nuevo en el servidor. |
| Sedes | Las sedes activas alimentan la asignación y el filtro; las consultas limitadas respetan las sedes del actor. |
| Logs | Las operaciones administrativas, cambios de cuenta, 2FA y accesos vinculados alimentan categorías distintas del historial individual; requiere el permiso de Logs. |

## Verificación

```bash
npm --prefix backend run test:admin-users-stage1
npm --prefix backend run test:admin-users-stage2
npm --prefix backend run test:admin-users-owner-guard
npm --prefix backend run test:admin-users-activity
npm --prefix frontend run test:admin-users-stage2
npm --prefix frontend run build
```

La concurrencia de dos desactivaciones de propietarios fue comprobada por el usuario contra MongoDB en una base aislada con `npm --prefix backend run test:admin-users-owner-concurrency`. La revisión de la nueva interacción visual y de los datos reales del administrador corresponde al entorno local del usuario. Los módulos Perfiles, Sedes y Logs conservan sus propios cierres pendientes; esta revisión cubre las conexiones de Usuarios con ellos. La integración a `main` corresponde al cierre conjunto de la etapa de Configuración.
