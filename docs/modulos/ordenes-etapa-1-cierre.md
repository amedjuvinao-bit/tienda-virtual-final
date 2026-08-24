# Cierre de Órdenes · Etapa 1

## Objetivo

Esta etapa convierte la evaluación del módulo en una base de cierre comprobable. No agrega otro proceso comercial: organiza la evidencia de lo que ya existe, separa el CI de Órdenes, elimina residuos técnicos y valida que cada perfil vea solamente las acciones que le corresponden.

Estado del trabajo local: **implementado y pendiente de ejecutar el nuevo Órdenes CI en GitHub**. El flujo remoto solo podrá comprobarse cuando estos cambios sean publicados con autorización expresa.

## Entregables

- flujo dedicado `.github/workflows/orders-ci.yml`, independiente de la visibilidad de Productos;
- contratos backend sin llamadas a Envia, Factus, Wompi, correo ni otros servicios reales;
- integraciones transaccionales sobre cinco bases MongoDB locales, temporales y separadas;
- pruebas visuales del listado, permisos, detalle, logística, posventa, cliente y precontrol fiscal;
- recorrido E2E del panel con propietario, bodega y solo lectura;
- recorrido E2E que conecta una orden fiscalmente apta con Facturación;
- compilación de producción antes de ejecutar los recorridos de navegador;
- acciones masivas y casillas de selección heredadas del tema administrativo;
- retiro del componente de fila legado y del log temporal de facturación.

## Matriz de aceptación

| Perfil | Escritorio | Celular | Puede operar | Debe permanecer oculto | Evidencia automática |
|---|---|---|---|---|---|
| Propietario | Bandeja, selección, exportación, seis secciones y gestión | Diseño adaptable por los contratos responsivos del detalle | Todas las acciones autorizadas por el rol privilegiado | Ninguna acción propia del módulo | `ownerDesktopScenario` y suites de seguridad/detalle |
| Bodega | Consulta de orden y trazabilidad operativa | Sin desborde horizontal; acceso a Operación y Posventa | Logística y expediente físico RMA | Factura, PDF, reembolso y gestión administrativa general | `warehouseMobileScenario` |
| Facturación | Consulta, documento de compra y conciliación monetaria según permisos | El detalle conserva navegación horizontal interna de pestañas | Precontrol fiscal, documentos y reembolsos autorizados | Operación física RMA si no posee `orders:returns` | contratos de permisos, reembolsos y `ordersBillingPreflight.e2e.js` |
| Solo lectura | Bandeja y detalle sin controles de mutación | Sin desborde horizontal | Consultar las seis secciones | Selección, exportación, PDF, factura y gestión | `readOnlyMobileScenario` y suites de seguridad |

## Recorrido integral exigido

1. La sesión administrativa se verifica antes de consultar órdenes.
2. La bandeja carga resumen comercial y prioridad operativa desde el backend.
3. `Gestionar` abre el expediente sin perder la orden visible.
4. Las seis secciones separan resumen, pedido, operación, posventa, pago/factura y cliente/historial.
5. Los permisos eliminan controles no autorizados; no se limitan a deshabilitarlos visualmente.
6. Bodega puede consultar el centro logístico y el RMA sin recibir autoridad fiscal.
7. Solo lectura no puede seleccionar, exportar ni mutar.
8. La orden apta puede pasar al precontrol de Facturación, donde la emisión exige confirmación humana.
9. Ninguna prueba de esta etapa contacta proveedores ni modifica una base persistente.

## Puertas de cierre

La etapa se considera técnicamente aprobada cuando se cumplen todas estas condiciones:

- `test:orders-stage1-closure` termina sin hallazgos;
- los contratos backend de Órdenes terminan correctamente;
- las integraciones de MongoDB aislado terminan y eliminan el contenedor;
- todas las suites frontend terminan correctamente;
- `vite build` compila la aplicación;
- los dos recorridos Playwright terminan sin errores de navegador;
- el flujo **Órdenes CI** queda verde en el commit publicado.

Mientras los cambios sigan exclusivamente locales, la última puerta permanece pendiente y no se declara cierre remoto.

## No forma parte de esta etapa

- publicar commits, fusionar la rama o desplegar la aplicación;
- activar Envia Producción o generar guías con costo;
- emitir facturas reales, notas crédito reales o cobros reales;
- usar credenciales reales en pruebas;
- registrar un webhook sobre `trycloudflare.com`;
- aprobar Producción sin un backend desplegado en una URL HTTPS permanente;
- pruebas manuales de dispositivos físicos o proveedores externos.

Estas dependencias se mantienen como puertas externas de producción y no deben confundirse con defectos del código local del módulo.

## Resultado local del 24 de agosto de 2026

| Control | Resultado |
|---|---|
| Contrato propio de la etapa | 10/10 controles aprobados |
| Contratos funcionales backend | 226 controles aprobados y plan transaccional aislado validado |
| Pruebas frontend | 88/88 aprobadas en 16 archivos |
| Compilación de producción | 1.989 módulos transformados sin errores |
| Sintaxis y diferencias | YAML válido, scripts Node válidos y `git diff --check` limpio |
| E2E de navegador local | Pendiente: el entorno no contiene Chromium y su red bloqueó la descarga temporal |
| Integraciones del nuevo CI | Pendientes de GitHub; no se publicó la rama durante esta etapa local |

El intento local de instalar Chromium terminó antes de ejecutar la aplicación porque el servidor de descarga entregó un archivo vacío. Por ello no se cuenta como fallo funcional. `orders-ci.yml` instala Chromium dentro de GitHub antes de ejecutar ambos recorridos E2E; esa evidencia debe quedar verde para completar el cierre remoto.
