# Finanzas Nivel Plus — Etapa 4

## Objetivo

La Etapa 4 cierra el recorrido operativo de Finanzas con un centro de control mensual por sede. El servidor reúne los hechos ya validados de ventas, costos, caja, gastos, presupuesto y tesorería; comprueba sus ecuaciones y permite guardar una certificación versionada con huella SHA-256.

Este corte es una herramienta gerencial de la tienda: **no es un cierre contable legal**, no genera asientos contables ni reemplaza un software contable. Tampoco altera órdenes, cajas, gastos o presupuestos. Guarda una fotografía auditable para comparar el estado certificado con los cambios posteriores.

## Controles automáticos

Antes de certificar, el servidor vuelve a calcular doce controles:

1. Ingresos netos menos costos igual a utilidad bruta.
2. Utilidad bruta menos gastos operativos igual a utilidad neta.
3. Presupuesto asignado menos comprometido y ejecutado igual a disponible.
4. Cobros menos pagos de los próximos 30 días igual a flujo proyectado.
5. Ausencia de sesiones de caja abiertas.
6. Diferencia de efectivo igual a cero.
7. Ausencia de productos vendidos sin costo.
8. Identificación de costos estimados.
9. Solicitudes de gasto pendientes.
10. Líneas presupuestales excedidas.
11. Gastos sin presupuesto activo.
12. Cobros y pagos vencidos.

Las ecuaciones inconsistentes, las cajas abiertas, las diferencias de efectivo y los costos faltantes son bloqueantes. Los costos estimados, solicitudes pendientes, excesos, gastos sin presupuesto y vencimientos se presentan como alertas de seguimiento.

## Certificación y excepciones

- Cada cierre pertenece a un único mes y una única sede.
- El mes actual se guarda como **corte provisional**; un mes terminado se guarda como **cierre mensual**.
- La primera certificación crea la versión 0.
- Una nueva certificación exige la versión vigente y una explicación; el historial anterior no se reemplaza.
- Una clave idempotente impide duplicar la misma solicitud.
- La huella SHA-256 se calcula sobre hechos ordenados de forma canónica. Si cambian los datos, la interfaz marca que el corte certificado ya no coincide.
- Dos responsables que intenten actualizar la misma versión no crean dos cierres.
- Un cierre con controles bloqueantes solo puede guardarse con `finance:periods:override` y una justificación excepcional.

## Permisos

- `finance:view`: consultar diagnóstico, cifras y controles.
- `finance:periods:certify`: certificar o actualizar un corte.
- `finance:periods:override`: autorizar justificadamente un cierre con diferencias críticas.
- `finance:export`: descargar el informe ejecutivo.

La certificación y la exportación continúan incluidas en el mapa central de auditoría administrativa.

## Interfaz e informe

El panel **Cierre financiero mensual** aparece dentro de la pantalla existente, sin barras laterales nuevas. Exige elegir una sede, permite cambiar el mes y muestra:

- estado general del control;
- versión y vigencia de la huella;
- ingresos, utilidad, presupuesto, cartera y flujo próximo;
- resultado explicativo de cada control;
- certificación normal o excepcional según permisos;
- informe CSV con indicadores, controles y huella de trazabilidad.

Todos los colores proceden del tema administrativo y el panel se adapta a escritorio y móvil.

## Índices y migración

La migración crea únicamente tres índices en `financeperiodcloses` y no elimina documentos ni índices:

```bash
npm --prefix backend run migrate:finance-period-close-indexes
npm --prefix backend run migrate:finance-period-close-indexes -- --apply-finance-period-close-index-migration
```

En producción también se exige:

```text
--confirm-production-finance-period-close-index-migration
```

## Validación

```bash
npm --prefix backend run test:finance-level-plus-stage0
npm --prefix backend run test:finance-level-plus-stage1
npm --prefix backend run test:finance-level-plus-stage2
npm --prefix backend run test:finance-level-plus-stage3
npm --prefix backend run test:finance-level-plus-stage4
npm --prefix frontend run test:finance-level-plus-stage0
npm --prefix frontend run test:finance-level-plus-stage1
npm --prefix frontend run test:finance-level-plus-stage2
npm --prefix frontend run test:finance-level-plus-stage3
npm --prefix frontend run test:finance-level-plus-stage4
npm --prefix frontend run build
```

La integración real solo acepta bases aisladas cuyo nombre comience por `finance_stage4_ci`:

```bash
FINANCE_STAGE4_MONGO_URI=mongodb://127.0.0.1:27017/finance_stage4_ci \
  npm --prefix backend run test:finance-level-plus-stage4-integration
```

La prueba cubre aislamiento por sede, huella, idempotencia, cambios posteriores, recertificación, concurrencia e informe ejecutivo sin tocar la base principal.
