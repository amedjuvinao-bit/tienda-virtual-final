# Módulo administrativo de Órdenes

## Estado del trabajo

- Rama de evolución: `feature/ordenes-admin-avanzado`.
- Etapa actual: **1. Seguridad y contratos**.
- Estado de la etapa: implementada y cubierta por pruebas automáticas.
- Siguientes etapas: orquestación de devoluciones, arquitectura/rendimiento, logística, experiencia visual avanzada y cierre integral.

Este documento registra las decisiones verificables del módulo. La etapa 1 no rediseña todavía la interfaz ni cambia la lógica económica de devoluciones; establece la frontera de confianza necesaria para evolucionar esas áreas sin exponer órdenes, clientes, inventario o facturación.

## Fronteras de confianza

### Sesión administrativa

El frontend consume exclusivamente la sesión validada por `AuthContext`. `OrdersAdmin` no lee tokens directamente de `localStorage` ni instala credenciales alternativas.

La autenticación heredada por `ADMIN_USER` y `ADMIN_PASSWORD_HASH` está deshabilitada por defecto. Solo puede habilitarse temporalmente con:

```env
ALLOW_LEGACY_ADMIN_AUTH=true
```

Aun habilitada, una sesión heredada no omite permisos granulares salvo que una ruta de migración lo autorice de forma explícita con `allowLegacyAdmin: true`. Ninguna operación del módulo de Órdenes usa esa excepción.

### Aislamiento por sede

La autoridad está centralizada en `backend/services/orderAdminScopeService.js`.

- `owner` y `admin`, los dos roles privilegiados definidos por el sistema, pueden operar todas las sedes.
- Los demás roles solo alcanzan su sede predeterminada y sus sedes asignadas.
- Una orden multisede pertenece al alcance cuando su sede principal o alguna asignación de inventario corresponde a una sede autorizada.
- Un usuario operativo sin sede asignada falla de forma cerrada con `NO_BRANCH_ASSIGNED`.
- Solicitar explícitamente una sede ajena responde `BRANCH_FORBIDDEN`.
- Una selección masiva que mezcle órdenes autorizadas y no autorizadas se rechaza completa con `ORDER_SELECTION_OUT_OF_SCOPE`.

El mismo alcance protege listado, detalle, estado, cumplimiento, impresión, archivo, datos de cliente, etiquetas, notas, historial, correo, PDF, XML, reembolso, exportación seleccionada y acciones masivas. También se verifica antes de generar/reintentar facturas o crear notas crédito desde una orden.

## Matriz RBAC

| Operación | Permiso |
|---|---|
| Listar y ver detalle, historial y notas | `orders:view` |
| Exportar resultados o selección | `orders:export` |
| Ejecutar estado/tags masivos | `orders:bulk` |
| Cambiar estado | `orders:status` |
| Actualizar prestación de servicio | `orders:update` |
| Marcar como impresa | `orders:mark_printed` |
| Archivar o desarchivar | `orders:archive` |
| Editar datos de cliente/facturación | `orders:customer_data` |
| Editar etiquetas | `orders:tags` |
| Crear, editar o eliminar notas | `orders:notes` |
| Enviar correo | `orders:email` |
| Descargar PDF/XML | `billing:download` |
| Procesar devolución | `orders:refund` |
| Crear/reintentar documentos electrónicos | permisos específicos `billing:*` |

La regla `DELETE /api/orders/:id` fue retirada del mapa porque no existe un endpoint de eliminación de órdenes. Esto evita declarar una capacidad destructiva ficticia.

## Contratos de datos

### Actores auditables

Los eventos administrativos toman el actor de la sesión validada (`adminUsername` o `adminUserId`). El encabezado manipulable `x-admin-user` no es autoridad para Órdenes, correos ni operaciones de facturación relacionadas.

### Cliente y facturación

`PATCH /api/orders/:id/customer-data` acepta únicamente campos incluidos en listas explícitas de cliente y facturación. Descarta objetos, arreglos y claves no autorizadas, limita textos y registra en el historial solo los nombres de campos modificados; no duplica valores personales completos dentro del evento de auditoría.

### Notas y etiquetas

- Notas: texto obligatorio, limpio y limitado a 2.000 caracteres.
- Edición de nota: rechaza parches vacíos o textos vacíos.
- Etiquetas: normalizadas, únicas, máximo 20 y 24 caracteres por etiqueta.
- El autor de una nota se deriva de la sesión y no del cuerpo HTTP.

### Correos

Existe una sola ruta autoritativa: `backend/routes/orderEmailRoutes.js`. Los cuatro tipos admitidos son:

- `confirmation`
- `invoice`
- `status`
- `payment`

La plantilla escapa contenido dinámico antes de generar HTML y la interfaz presenta exactamente esas cuatro acciones.

## Permisos en la interfaz

Un usuario con `orders:view` puede consultar listado, detalle, historial, inventario asignado y notas existentes. Cada control de mutación se renderiza solo cuando existe su permiso correspondiente:

- exportación y selección;
- estado y etiquetas;
- impresión y archivo;
- creación de notas;
- envío de correo;
- edición de prestaciones;
- descarga de documentos electrónicos.

Las funciones también verifican sesión y permiso antes de ejecutar la solicitud, de modo que ocultar botones no es la única barrera.

## Verificación desde consola

Desde la raíz del repositorio en Windows:

```bat
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:orders-security
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-refund-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-bulk-status-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:order-multi-branch-contract
npm --prefix C:\MisProyectosReact\tienda-virtual-final\backend run test:complete-sale-contract
cd /d C:\MisProyectosReact\tienda-virtual-final\frontend && npm run test:orders-security && npm exec -- vitest run && npm run build
```

Las integraciones transaccionales que usan MongoDB se ejecutan por separado cuando existe `PRODUCTS_TEST_MONGO_URI` o `MONGODB_REPLICA_URI`; no deben apuntar a datos productivos.

## Evidencia de la etapa 1

- Seguridad backend: 10 controles, incluyendo respuestas HTTP 401/403, RBAC, sede, actores y contratos.
- Seguridad frontend: 7 pruebas de sesión, solo lectura, capacidades y controles de detalle.
- Regresión frontend completa: 23 archivos y 88 pruebas.
- Build de producción: aprobado con Vite.
- Contratos vecinos verificados: estados masivos, multisede, venta completa, facturación, favoritos y carritos.

## Trabajo pendiente deliberado

1. Orquestación avanzada de devolución, nota crédito, inventario y caja.
2. Separación del archivo monolítico de rutas y optimización de consultas/resúmenes.
3. Flujo logístico avanzado: picking, packing, despacho, transportadora, SLA e incidencias.
4. Rediseño visual operativo con bandejas, densidad configurable y acciones contextuales.
5. Pruebas transaccionales/stress con réplica MongoDB y cierre formal de la rama.
