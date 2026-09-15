# Configuración Nivel Plus — Etapa 0

## Objetivo

Cerrar la base técnica y de seguridad del bloque **Configuración** antes de
avanzar con mejoras visuales módulo por módulo.

## Alcance implementado

- Se mantiene el bloque general **Configuración** del menú administrativo.
- Se retira únicamente la entrada duplicada **Facturación** de ese bloque.
- El módulo principal de Facturación y sus rutas no se modifican.
- La ruta heredada `/admin/configuracion/facturacion` continúa redirigiendo a
  `/admin/facturacion/configuracion` para no romper marcadores existentes.
- Los cambios enviados a `/api/site-settings` exigen permisos según la sección
  exacta del payload.
- Envíos guarda solamente `theme.global.envios`; no reenvía ni sobrescribe
  otras secciones globales.
- Logs usa la ruta administrativa canónica `/api/admin/audit-logs`, protegida
  por `logs:view`; la exportación usa `logs:export`.
- Producción valida secretos mínimos, claves de cifrado y URLs HTTPS antes de
  iniciar el backend.
- CORS queda abierto al origen de desarrollo y limitado en producción a los
  orígenes configurados del frontend/backend.
- Se incorpora un workflow CI dedicado a Configuración.

## Matriz de permisos para escritura global

| Sección recibida | Permiso exigido |
| --- | --- |
| `store` | `settings:store` |
| `admin` | `settings:panel` |
| `loginAdmin` | `settings:login` |
| `billing` | `billing:settings` |
| `menus` | `appearance:menus` |
| `theme` visual | `appearance:update` |
| `theme.global.payments` | `settings:payments` |
| `theme.global.envios` | `settings:shipping` |

Una solicitud con varias secciones debe cumplir todos los permisos resueltos.
Las claves de nivel superior desconocidas se rechazan y `updatedBy` se toma
exclusivamente de la identidad autenticada.

## Variables obligatorias en producción

- `MONGO_URI`
- `FRONTEND_URL` con HTTPS
- `BACKEND_URL` con HTTPS
- `JWT_SECRET` de al menos 32 caracteres
- `CART_ACCESS_SECRET` de al menos 32 caracteres
- `ORDER_PAYMENT_ACCESS_SECRET` de al menos 32 caracteres
- `BILLING_ENCRYPTION_KEY` de al menos 32 caracteres
- `INTEGRATIONS_ENCRYPTION_KEY` de al menos 32 caracteres
- `MAIL_ENCRYPTION_KEY` de al menos 32 caracteres

Las claves de cifrado pueden generarse antes de contratar proveedores externos;
no se exige disponer de una cuenta Factus o Envia para usar el modo manual o
mantener esas integraciones desactivadas.

## Validación local

```bash
npm --prefix backend run test:configuration-level-plus-stage0
npm --prefix frontend run test:configuration-level-plus-stage0
npm --prefix frontend run test:shipping-settings-ui
npm --prefix frontend run build
```

El workflow `Configuracion CI` amplía este cierre con auditoría de dependencias
y contratos ya existentes de pagos y envíos.
