# Usuarios Nivel Plus — paso 2: sedes y listado

La pantalla de Usuarios consulta ahora al servidor por página (20 cuentas), texto y estado. El total y las páginas proceden de la respuesta del backend, de modo que una cuenta fuera de los primeros 50 resultados sigue disponible. La búsqueda espera 300 ms tras escribir y descarta respuestas antiguas para que no sustituyan los resultados recientes.

En el formulario se seleccionan varias sedes y una principal. Al editar se conservan los permisos de venta, inventario y facturación que ya tenía el usuario en cada sede; la lista de sedes solo puede modificarse con el permiso de asignación. Un administrador con alcance limitado no puede conceder en una sede una capacidad que no tiene, aunque sí puede conservar las capacidades que el usuario ya tenía. El backend comprueba que las sedes solicitadas existan y estén activas, que la principal pertenezca a la selección y que el estado coincida con el acceso activo. Una combinación inválida devuelve 400 sin guardar el usuario.

## Comprobación

```bash
npm --prefix frontend run test:admin-users-stage2
npm --prefix backend run test:admin-users-stage1
npm --prefix backend run test:admin-users-stage2
npm --prefix frontend run build
```

Las pruebas comprueban el cambio de página, búsqueda y filtro a través de la API, la conservación de permisos por sede al cambiar la principal y las reglas del paso 1. La validación integrada con MongoDB y varios perfiles reales y la revisión visual siguen pendientes antes del cierre del módulo.
