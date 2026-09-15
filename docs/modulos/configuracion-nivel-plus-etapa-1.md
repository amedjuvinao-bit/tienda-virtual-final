# Configuración Nivel Plus — Etapa 1: Tienda

## Objetivo

Convertir **Configuración > Tienda** en la fuente administrativa protegida de
la identidad comercial, los canales de contacto y la operación principal de la
tienda, sin duplicar responsabilidades fiscales del módulo **Facturación**.

## Alcance implementado

- Navegación compacta en tres secciones: **Identidad**, **Contacto** y
  **Operación**.
- Resumen contextual, porcentaje de datos esenciales, versión vigente y aviso
  de cambios sin guardar.
- Validación inmediata en interfaz y validación canónica obligatoria en backend.
- Mensajes en pantalla para éxito, errores de campos y conflictos; no se usan
  alertas nativas del navegador.
- Advertencia al intentar cerrar la pestaña con cambios pendientes.
- Ruta dedicada `GET/PUT /api/admin/store-settings`, protegida con
  `settings:store`.
- Actualización mediante revisión optimista (`storeRevision`) para impedir que
  dos administradores sobrescriban cambios silenciosamente.
- Auditoría del usuario autenticado en `updatedBy`; el cliente no puede escoger
  ese valor.
- La ruta global `/api/site-settings` rechaza escrituras sobre `store` para
  conservar una sola autoridad de actualización.
- La revisión interna y el autor de la modificación no se exponen en la
  configuración pública.

## Contrato de datos

| Sección | Campos |
| --- | --- |
| Identidad | nombre comercial, razón social opcional y sitio web |
| Contacto | correo principal, teléfono, WhatsApp y correo de atención |
| Operación | dirección, ciudad, departamento, país, zona horaria, idioma y horario |

Los campos de NIT, responsabilidades tributarias, resolución, DIAN y proveedor
electrónico continúan exclusivamente en el módulo principal **Facturación**.

## Validación y seguridad

- Nombre, correo, teléfono, dirección, ciudad y departamento son obligatorios.
- Correos, teléfonos, URL, país, zona horaria e idioma se normalizan y validan
  en el servidor.
- El payload se reduce a una lista explícita de campos; las propiedades ajenas
  al contrato no se persisten ni se devuelven.
- Toda escritura exige una revisión entera vigente. Una revisión desactualizada
  responde `409 STORE_SETTINGS_CONFLICT` sin escribir en base de datos.
- Los errores de validación responden `422 INVALID_STORE_SETTINGS` con detalle
  por campo.

## Validación local

```bash
npm --prefix backend run test:configuration-level-plus-stage1
npm --prefix frontend run test:configuration-level-plus-stage1
npm --prefix frontend run build
```

El workflow `Configuracion CI` ejecuta estas verificaciones junto con las de la
Etapa 0 y los contratos existentes de pagos y envíos.
