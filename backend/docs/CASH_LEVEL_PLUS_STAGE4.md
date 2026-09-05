# Caja Nivel Plus - Etapa 4

La Etapa 4 completa el control operativo con un cierre diario certificado por sede. El supervisor congela una instantánea autoritativa de la jornada después de revisar todas las cajas y el sistema impide que el día certificado vuelva a modificarse mediante nuevas aperturas.

## Certificación diaria

- Solo un supervisor con acceso a la sede puede certificar la jornada.
- Deben existir sesiones y todas deben estar cerradas.
- No puede haber arqueos pendientes ni inconsistencias críticas de conciliación.
- Una jornada con faltantes o sobrantes exige observación de supervisión.
- El certificado conserva período, totales, alertas, sesiones, responsable y una huella SHA-256.
- La combinación sede-fecha es única; repetir la solicitud devuelve el mismo certificado.
- Después de certificar, la sede no admite nuevas aperturas durante esa fecha operativa de `America/Bogota`.

## Producción

Antes de activar la función en una base existente, revisar y aplicar el índice único:

```bash
npm --prefix backend run migrate:cash-journey-close-indexes
npm --prefix backend run migrate:cash-journey-close-indexes -- --apply-cash-journey-close-index-migration
```

## Verificación

```bash
npm --prefix backend run test:cash-level-plus-stage4
npm --prefix frontend run test:cash-level-plus-stage4
```

La integración usa exclusivamente la base desechable `cash_stage4_ci`:

```bash
CASH_STAGE4_MONGO_URI='mongodb://127.0.0.1:27017/cash_stage4_ci?replicaSet=rs0' npm --prefix backend run test:cash-level-plus-stage4-integration
```
