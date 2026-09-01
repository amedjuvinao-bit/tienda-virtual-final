# POS nivel Plus - Etapa 0: línea base

Fecha: 2026-09-01

## Punto de partida

- Rama: `feature/pos-nivel-plus-etapa-1`
- Base: `origin/main`
- Commit base: `52cf744`
- Alcance de esta etapa: preparación, trazabilidad y pruebas sin cambios funcionales.

## Estado funcional observado

El POS existente ya conecta ventas físicas con:

- sedes e inventario;
- órdenes y clientes;
- sesiones de caja;
- comprobantes y facturación electrónica.

La auditoría inicial lo clasifica como una base avanzada incompleta. Antes de producción nivel Plus deben resolverse, como mínimo, la idempotencia real de ventas, el control de caja por sede y operador, la separación segura entre comprobante y factura electrónica y el flujo completo de pagos.

## Línea base de validación

| Validación | Resultado |
| --- | --- |
| Cálculos base del servicio POS | Aprobada |
| Catálogo de permisos POS | Aprobada |
| Modelo `Order` para ventas POS | Aprobada |
| Modelo `CashSession` y arqueo | Aprobada |
| Compilación de producción del frontend | Aprobada |
| Integración POS + inventario con MongoDB | Pendiente de entorno |

La validación integral `test:pos-inventory` requiere `MONGODB_URI`. En esta copia de trabajo no existe esa configuración, por lo que la prueba terminó antes de ejecutar escenarios y no reportó un defecto funcional.

## Criterio de protección

Cada etapa posterior debe conservar las validaciones aprobadas y agregar pruebas específicas para sus cambios. La rama no se integrará en `main` hasta completar la auditoría final del POS nivel Plus.
