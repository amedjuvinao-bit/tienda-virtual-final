# Perfiles Nivel Plus — etapa 1

Rama: `feature/configuracion-perfiles-nivel-plus`, creada desde el cierre de Usuarios. `main` no se modifica en esta etapa.

## Qué se corrigió

- El listado muestra cuántas cuentas usan cada perfil, sumando referencias por ID y cuentas anteriores que conservan solo el código. La búsqueda y la navegación consultan al servidor; ya no se ocultan perfiles después de los primeros 100.
- Un perfil en uso no se puede desactivar, eliminar ni cambiar de código. La protección se ejecuta en el servidor y se refleja en los botones.
- La interfaz usa el rol y los permisos de quien inició sesión. Un encargado no recibe controles de propietario. Las operaciones sobre perfiles superiores también se rechazan en el servidor.
- El estado y el indicador de activación deben ser coherentes. Activar un perfil con usuarios existentes sí está permitido; desactivarlo exige `roles:disable`, incluso si llega mediante la edición general.

## Comprobación

```bash
cd backend && npm run test:admin-roles-stage1
cd frontend && npm run test:admin-roles-stage1 && npm run build
```

La prueba funcional en el panel con el usuario real y el diseño final de Perfiles corresponden a las próximas etapas. Este documento registra una primera mejora y no constituye el cierre del módulo.

## Etapa 2 — navegación y trazabilidad

- Se sustituyeron las tarjetas altas por filas compactas adaptables al ancho de pantalla, con estado, alcance, nivel, permisos y acciones en un mismo bloque.
- El número de usuarios lleva al módulo Usuarios con el perfil seleccionado como filtro, siempre que el administrador tenga permiso para ver usuarios.
- La ruta real de activación y desactivación (`PATCH /api/admin/roles/:id/status`) queda asociada a la auditoría de `roles:disable`. Al crear un perfil, el registro de auditoría incluye el ID del nuevo perfil.
- La integración se comprueba con pruebas de navegación Perfiles → Usuarios y del filtro recibido por Usuarios.

## Protección del perfil predeterminado

La selección de otro perfil predeterminado retira la selección anterior y guarda la nueva dentro de una transacción. Un índice único parcial impide que queden dos perfiles activos seleccionados por escrituras simultáneas o directas. El servidor rechaza quitar la única selección sin elegir otra, y el seed administrativo conserva la elección realizada en el panel.

Antes de habilitar el índice en una base existente, ejecutar `npm run validate:role-default` desde la raíz. Si hay exactamente un perfil predeterminado activo y falta el índice, ejecutar `npm --prefix backend run migrate:admin-role-default-index -- --apply`. Si aparecen cero o varios, escoger el ID de un perfil activo y ejecutar `npm --prefix backend run migrate:admin-role-default-index -- --apply --default=ID`; la corrección de la selección y la creación del índice se hacen en ese orden. En producción el comando exige además `--confirm-production`. Repetir `npm run validate:role-default` hasta obtener `ready: true`. El comando `--verify` solo consulta, no cambia datos.

La prueba de MongoDB transaccional `npm --prefix backend run test:admin-role-default-mongo` usa exclusivamente la base aislada `orders_ci_role_default` y se ejecuta en CI. La revisión funcional real de Perfiles y su cierre Nivel Plus continúan pendientes. El PR permanece en borrador y no se integra a `main` hasta cerrar Usuarios, Perfiles y Sedes.
