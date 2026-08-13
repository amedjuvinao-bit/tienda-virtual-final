# Cierre del módulo de Favoritos

Fecha de cierre: **13 de agosto de 2026**.

## Objetivo

El módulo de Favoritos conserva el interés de compra de visitantes anónimos y lo convierte en información operativa para el equipo administrativo. La solución cubre la lista pública del comprador, la propiedad segura de cada sesión, la autoridad comercial del backend, los indicadores globales, la búsqueda, los filtros, la exportación y el detalle vigente de productos, variantes e inventario.

El panel administrativo se encuentra en `/admin/favoritos`. Utiliza exclusivamente la sesión legítima de `AuthContext`; la interfaz oculta las acciones que el usuario no puede ejecutar y el backend vuelve a exigir el permiso correspondiente en cada endpoint protegido.

## Acceso anónimo seguro

El navegador no fabrica un identificador aislado. La primera operación solicita al backend una pareja compuesta por:

- `sessionId`, con formato `fav_...`.
- `favoriteAccessToken`, firmado mediante HMAC-SHA256 y ligado a una única sesión.

El frontend conserva ambos valores en `localStorage` y los envía únicamente mediante los encabezados `X-Favorite-Session-Id` y `X-Favorite-Access-Token`. No se incluyen en URL, query string, cuerpo de la solicitud ni registros de consola.

Las rutas públicas de lectura, sincronización y eliminación aplican la misma validación de propiedad. Una credencial ausente, alterada o perteneciente a otra sesión recibe una respuesta genérica `404`, sin revelar si existe una lista ajena.

La autoridad secreta se resuelve en este orden:

1. `FAVORITE_ACCESS_SECRET`.
2. `CART_ACCESS_SECRET`, como compatibilidad.
3. `JWT_SECRET`, como último fallback.

El valor efectivo debe tener al menos 32 caracteres. En producción se recomienda configurar un `FAVORITE_ACCESS_SECRET` independiente y rotarlo mediante el procedimiento general de secretos; nunca debe exponerse como variable `VITE_*`.

## Autoridad de producto y persistencia

El cliente solamente solicita productos y variantes. Antes de escribir, el backend consulta el catálogo y reemplaza título, imagen, precio, slug, SKU, categoría y atributos por sus valores canónicos. También descarta productos inválidos, duplicados, archivados o no disponibles.

Cada sesión tiene un índice único y admite como máximo 200 productos. No se conservan documentos vacíos: si el comprador retira el último producto, la lista se elimina. `lastCustomerActivityAt` registra actividad real del comprador y `timestamps` conserva creación y última modificación.

## Panel administrativo

El panel presenta seis indicadores calculados en MongoDB sobre el conjunto filtrado completo, no solamente sobre la página visible:

- Listas activas.
- Productos guardados.
- Valor potencial acumulado.
- Valor promedio por lista.
- Actividad reciente durante los últimos 7 días.
- Listas de alta intención con 3 productos o más.

Las vistas rápidas son: todos, recientes, alta intención, alto valor y sin actividad. Alto valor corresponde a `$200.000` o más y sin actividad a 30 días o más.

La búsqueda cubre sesión, nombre, SKU y categoría del producto. Puede combinarse con rango de fechas, cantidad mínima o máxima de productos, valor mínimo o máximo, paginación y los ordenamientos más recientes, más antiguos, más productos y mayor valor.

El listado y el resumen se solicitan de forma independiente. Si uno falla, el otro permanece disponible y se ofrece un reintento controlado. El detalle lateral contrasta cada favorito con el catálogo vigente e informa variante, SKU, precio actual, inventario, disponibilidad y alertas por cambios o productos no disponibles.

La exportación genera `favoritos.csv` en UTF-8 con BOM, escapa las celdas y admite hasta 10.000 listas del filtro actual, sin quedar limitada a la página visible.

## Acciones destructivas

Retirar un producto y eliminar una lista exigen `favorites:delete`. Antes de enviar cualquiera de estas operaciones, la interfaz muestra una confirmación explícita y bloquea acciones repetidas mientras la solicitud está en curso.

Cuando se intenta retirar el último producto, el aviso indica que también desaparecerá la lista completa y que la acción no se puede deshacer. Cancelar el aviso conserva los datos y no llama al endpoint. Estas protecciones complementan, pero no sustituyen, la autorización del backend.

## Endpoints

El router está montado en `/api/favorites`.

### Comprador

| Método | Ruta | Propósito |
| --- | --- | --- |
| POST | `/api/favorites/access` | Emitir una sesión y credencial firmada. |
| GET | `/api/favorites/:sessionId` | Consultar la lista propia. |
| PUT | `/api/favorites/:sessionId` | Canonicalizar y sincronizar la lista propia. |
| DELETE | `/api/favorites/:sessionId` | Eliminar la lista propia. |

Las tres operaciones asociadas a `:sessionId` requieren los encabezados de propiedad dedicados.

### Administración

| Método | Ruta | Propósito | Permiso |
| --- | --- | --- | --- |
| GET | `/api/favorites/admin` | Listado filtrado, ordenado y paginado. | `favorites:view` |
| GET | `/api/favorites/admin/summary` | Indicadores globales del filtro actual. | `favorites:view` |
| GET | `/api/favorites/admin/export` | Exportación CSV del filtro actual. | `favorites:export` |
| GET | `/api/favorites/admin/:id` | Detalle canónico e inventario vigente. | `favorites:view` |
| DELETE | `/api/favorites/admin/:id/items/:itemId` | Retirar un producto. | `favorites:delete` |
| DELETE | `/api/favorites/admin/:id` | Eliminar una lista completa. | `favorites:delete` |

La exportación y las dos eliminaciones están marcadas para auditoría; las eliminaciones también están clasificadas como operaciones peligrosas en el mapa central de permisos.

## Datos trazables de demostración

El comando `demo:favorites-trace` crea sesiones aleatorias con productos y variantes reales del catálogo. Distribuye perfiles recientes, de alta intención, de alto valor y antiguos. Requiere `--confirm-persist`, valida límites de carga, produce un prefijo buscable `fav_trace_...` y no contiene ninguna operación de borrado o limpieza automática.

La ejecución de cierre creó y verificó 16 sesiones, 77 productos favoritos y `$67.319.899` de valor potencial. Después se eliminó intencionalmente desde el panel una lista de un producto para probar el flujo destructivo. Permanecen 15 listas de esa ejecución, con 76 productos y `$64.820.899`, además de los demás documentos que ya existían en la base.

Los datos de demostración permanecen en MongoDB para trazabilidad. No deben ejecutarse nuevas cargas en producción sin una etiqueta identificable y autorización expresa.

Ejemplo controlado:

```cmd
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run demo:favorites-trace -- --confirm-persist --sessions=16 --label=trazabilidad-agosto
```

## Archivos principales

Backend:

- `backend/models/Favorite.js`
- `backend/routes/favoriteRoutes.js`
- `backend/services/favoriteAccessService.js`
- `backend/services/favoriteOperationsService.js`
- `backend/security/adminRoutePermissionMap.js`
- `backend/scripts/testFavoritesModuleIntegrity.js`
- `backend/scripts/seedPersistentFavoritesTrace.js`
- `backend/scripts/testPersistentFavoritesTraceSeed.js`

Frontend:

- `frontend/src/context/FavoritesContext.jsx`
- `frontend/src/utils/favoriteAccess.js`
- `frontend/src/pages/Favoritos.jsx`
- `frontend/src/admin/FavoritosAdmin.jsx`
- `frontend/src/admin/FavoritosAdmin.css`
- `frontend/src/admin/favoriteAdminApi.js`

## Verificación desde consola

Pruebas específicas del backend:

```cmd
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:favorites-module && npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:favorites-trace-seed
```

Suite completa del frontend y compilación:

```cmd
cd /d C:\MisProyectosReact\tienda-virtual-final\frontend && npm exec -- vitest run && npm run build
```

## Resultado de cierre

- Integridad y seguridad del backend: **11/11** controles aprobados.
- Seguridad del generador persistente: **7/7** controles aprobados.
- Frontend completo: **81/81** pruebas aprobadas en **21/21** archivos.
- Panel administrativo de Favoritos: **8/8** pruebas aprobadas.
- Build Vite: aprobado con **1.979 módulos transformados**.
- Prueba real de persistencia MongoDB: aprobada.
- Búsqueda, filtros, métricas, detalle, CSV y permisos: verificados.
- Confirmación y cancelación de eliminaciones: verificadas automáticamente y en navegador.
- GitHub Actions `Productos CI` y `Facturacion CI`: aprobados antes del cierre.

## Restricciones operativas

- No editar precios, inventario, SKU ni variantes directamente en la colección `favorites`.
- No enviar la credencial de Favoritos por URL, logs, analítica o mensajería.
- No sustituir la sesión administrativa por tokens incrustados en el navegador.
- No interpretar valor potencial como una venta confirmada.
- No ejecutar el generador persistente sin `--confirm-persist` y una etiqueta de trazabilidad.
- No borrar masivamente las sesiones trazables sin una tarea de limpieza separada, revisada y autorizada.
- Cualquier cambio en permisos debe actualizar también `adminRoutePermissionMap.js` y sus pruebas.
