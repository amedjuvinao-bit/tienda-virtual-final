# Cierre de Órdenes · Etapa 3

## Objetivo

Esta etapa convierte la lectura administrativa de Órdenes en una consulta escalable. La bandeja mantiene filtros, totales y orden estable aunque el volumen crezca, evita repetir el cálculo completo al cambiar únicamente de página y cancela las solicitudes que quedaron obsoletas cuando el administrador cambia rápidamente de criterio.

La Etapa 3 **no agrega una pantalla nueva**. Fortalece la bandeja existente en `Administración → Órdenes`; su resultado visible es que la página responde de forma coherente, no retrocede a un filtro anterior y conserva los indicadores durante la paginación.

## Qué cambia para el administrador

- Entrar o cambiar un filtro comercial calcula la página y sus indicadores.
- Cambiar página, tamaño, orden o población de productos solicita solo las filas visibles.
- Fechas o valores iguales no producen órdenes repetidas entre páginas porque `_id` funciona como desempate estable.
- Escribir varios filtros rápidamente cancela la lectura anterior y conserva únicamente la respuesta vigente.
- Los totales permanecen visibles mientras se navega por páginas sin volver a recorrer todas las órdenes.
- El alcance por sede continúa incluyendo la sede principal y las asignaciones multisede autorizadas.

## Entregables

- cancelación segura con `AbortController` y suscriptores dentro de `useOrdersAdminQuery`;
- conservación de la deduplicación del doble efecto de React `StrictMode`;
- integración MongoDB aislada `testOrderAdminQueryScaleIntegration.js`;
- 1.200 órdenes y facturas ficticias para comprobar página, métricas, índices y alcance por sede;
- 24 lecturas paginadas concurrentes que omiten el resumen completo;
- recorrido Playwright `ordersScalableQuery.e2e.js`;
- contrato `test:orders-stage3-closure` y puertas dedicadas en **Órdenes CI**.

## Matriz de aceptación

| Caso | Comportamiento exigido | Evidencia |
|---|---|---|
| Primera carga | Página, total, ventas, facturas y colas concilian con el mismo filtro | Integración MongoDB |
| Página siguiente | Ejecuta una sola agregación y devuelve máximo el límite solicitado | Integración y E2E |
| Fechas iguales | No repite ni omite filas entre páginas | Orden estable por `createdAt` y `_id` |
| Cambio rápido de filtro | Cancela la lectura anterior; su respuesta no reemplaza la actual | Hook y E2E |
| React `StrictMode` | Dos efectos iguales reutilizan una sola solicitud y no se cancelan entre sí | Prueba del hook |
| Usuario de sede | Solo recibe órdenes de su sede principal o asignaciones autorizadas | Integración MongoDB |
| Mucha concurrencia | Las páginas permanecen acotadas y no recalculan indicadores | 24 consultas concurrentes |

## Seguridad y aislamiento

La integración exige `ORDERS_STAGE3_MONGO_URI`, host `127.0.0.1` o `localhost`, base exacta `orders_ci_stage3_query` y `replicaSet=rs0`. No acepta Atlas, no lee `MONGODB_URI` y elimina exclusivamente esa base temporal al terminar o fallar.

Las órdenes, clientes, productos y facturas son completamente ficticios. Las pruebas no llaman Wompi, PayU, Factus, Envia, correo, webhooks ni ningún otro proveedor. El E2E intercepta todas las rutas `/api/` y usa direcciones `.invalid`.

## Prueba manual

1. Abrir `Administración → Órdenes` y anotar el total visible.
2. Pulsar `Siguiente` y comprobar que el total no desaparece ni cambia.
3. Abrir los filtros, escribir una búsqueda y sustituirla inmediatamente por otra.
4. Verificar que la tabla termina mostrando solamente la última búsqueda y no regresa después a la anterior.

Esta comprobación no crea, edita, factura, despacha ni reembolsa órdenes.

## Puertas de cierre

- contrato propio de la etapa;
- contrato de arquitectura backend;
- pruebas unitarias de concurrencia React;
- integración MongoDB con volumen e índices físicos;
- regresión completa del frontend;
- compilación Vite;
- recorrido Playwright de paginación y filtros rápidos;
- **Órdenes CI** verde después de publicar con autorización.

## Estado local

Implementación validada localmente y **sin publicación**. La etapa no se declarará cerrada remotamente hasta que el usuario autorice el commit y GitHub ejecute todas las puertas en verde.

| Control local | Resultado |
|---|---|
| Contrato propio de la etapa | 10/10 controles aprobados |
| Arquitectura backend | 10/10 controles aprobados |
| Regresión frontend completa | 175/175 pruebas aprobadas en 38 archivos |
| Compilación de producción | 1.989 módulos transformados sin errores |
| Integración MongoDB aislada | Pendiente del runner: el entorno local no dispone de MongoDB ni Docker |
| E2E de navegador | Pendiente del runner: el entorno local no contiene Chromium |
