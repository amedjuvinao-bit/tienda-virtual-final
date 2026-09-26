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
