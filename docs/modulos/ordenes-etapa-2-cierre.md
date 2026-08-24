# Cierre de Órdenes · Etapa 2

## Objetivo

Esta etapa demuestra que una devolución no termina al devolver unidades al inventario. El módulo debe mantener coherentes cuatro resultados posteriores: dinero, caja, documento fiscal y estado comercial de la orden. La interfaz debe indicar una sola tarea siguiente y nunca presentar como cerrada una obligación que todavía dependa del administrador o de un proveedor externo.

## Recorrido comprobado

1. Un reembolso procesado confirma la resolución de inventario.
2. La caja registra la devolución comercial, pero no descuenta el medio de pago hasta recibir una referencia verificable del reverso.
3. Una factura validada mantiene la conciliación abierta hasta vincular una nota crédito oficial completada.
4. La devolución total cambia la orden a `refunded` únicamente cuando las cuatro etapas están completas o no aplican.
5. Una devolución parcial puede quedar conciliada sin marcar toda la orden como reembolsada.
6. Repetir la misma referencia monetaria es idempotente; intentar sustituirla por otra produce conflicto.

## Entregables

- integración MongoDB aislada `testOrderCommercialReconciliationIntegration.js`;
- base temporal exclusiva `orders_ci_stage2_reconciliation` sobre una réplica local;
- limpieza obligatoria de la base temporal al terminar o fallar;
- guía visual `Siguiente paso` dentro de `Pago y factura`;
- adaptación móvil mediante clases propias, sin selectores globales por estilos en línea;
- recorrido Playwright con perfil de Facturación;
- puertas dedicadas dentro de **Órdenes CI**;
- contrato `test:orders-stage2-closure` para impedir que estas garantías desaparezcan.

## Matriz de aceptación

| Caso | Inventario | Dinero | Caja | Documento fiscal | Resultado permitido |
|---|---|---|---|---|---|
| Total con factura validada | Completo | Confirmado | Recalculada | Nota crédito vinculada | Orden `refunded` |
| Total sin confirmar dinero | Completo | Requiere acción | Sin descontar el pago | Según factura | Orden conserva su estado anterior |
| Total sin nota crédito | Completo | Confirmado | Recalculada | Requiere acción | Orden conserva su estado anterior |
| Parcial conciliado | Completo | Confirmado | Recalculada o no aplica | Completo o no aplica | Conciliación completa; orden no cambia a `refunded` |
| Referencia monetaria repetida | Sin cambios | Idempotente | Sin doble descuento | Sin cambios | Se reutiliza el resultado |
| Referencia monetaria diferente | Sin cambios | Conflicto | Sin cambios | Sin cambios | Operación rechazada |

## Seguridad de las pruebas

La integración exige `ORDERS_STAGE2_MONGO_URI`, host `127.0.0.1` o `localhost`, base exacta `orders_ci_stage2_reconciliation` y `replicaSet=rs0`. No acepta Atlas, no usa `MONGODB_URI` y elimina exclusivamente esa base temporal.

La prueba no llama Wompi, no llama Factus y no contacta servicios de correo, transportadoras ni webhooks. La factura y la nota crédito utilizadas son documentos ficticios persistidos únicamente dentro de la base temporal. El E2E intercepta todas las APIs y usa direcciones `.invalid`.

## Puertas de cierre

- contrato de la etapa: 10/10 controles;
- integración MongoDB completa;
- pruebas frontend del panel de conciliación;
- regresión completa del módulo de Órdenes;
- compilación Vite;
- E2E del perfil de Facturación;
- **Órdenes CI** en verde después de publicar con autorización.

## Dependencias externas que siguen pendientes

Esta etapa no autoriza movimientos reales ni declara listo el paso a producción de los proveedores. El `void` de Wompi y la emisión de la nota crédito en Factus deben comprobarse posteriormente con credenciales y ambientes controlados. Envia Producción continúa exigiendo backend desplegado en una URL HTTPS permanente, credenciales reales y webhook auténtico. Ninguna de esas condiciones debe simularse con un túnel temporal.

## Estado local

Implementación preparada sin publicación.

| Control local | Resultado |
|---|---|
| Contrato propio de la etapa | 10/10 controles aprobados |
| Contratos backend relacionados | 48/48 controles aprobados |
| Regresión frontend completa | 175/175 pruebas aprobadas en 38 archivos |
| Panel de conciliación | 5/5 pruebas aprobadas |
| Compilación de producción | 1.989 módulos transformados sin errores |
| Sintaxis y diferencias | Scripts válidos y `git diff --check` limpio |
| Integración MongoDB aislada | Pendiente del runner: el entorno local no dispone de Docker ni MongoDB |
| E2E de navegador | Pendiente del runner: el entorno local no contiene Chromium |

La etapa solo se declarará cerrada remotamente cuando el commit sea autorizado y **Órdenes CI** ejecute en verde la integración MongoDB y el recorrido Playwright.
