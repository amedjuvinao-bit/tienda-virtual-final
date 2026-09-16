# Configuración Nivel Plus — Etapa 2: Pagos

## Objetivo

Convertir **Configuración > Pagos** en la autoridad administrativa segura para
seleccionar y preparar el proveedor usado por el checkout, sin mezclar la
configuración fiscal del módulo principal **Facturación**.

## Alcance implementado

- Experiencia compacta en tres pasos: **Proveedor**, **Credenciales** y
  **Checkout**.
- Solo se ofrecen los proveedores que el flujo de órdenes admite realmente:
  **Wompi**, **PayU** y **Pago manual**.
- Estado de preparación por proveedor y resumen operativo visible durante toda
  la configuración.
- Ruta dedicada `GET/PUT /api/admin/payment-settings`, protegida con
  `settings:payments`.
- Control de concurrencia mediante `paymentSettingsRevision` para impedir
  sobrescrituras silenciosas entre administradores.
- Bloqueo de escrituras paralelas de Pagos desde la ruta global
  `/api/site-settings`.
- Prueba de comercio Wompi mediante la integración administrativa existente,
  sin enviar llaves privadas desde la interfaz.
- URL de webhook calculada desde la URL configurada del backend, no desde el
  dominio del panel web.
- Confirmación explícita antes de guardar un proveedor activo en producción.
- Moneda COP obligatoria para Wompi Colombia.

## Protección de credenciales

- Las llaves privadas, claves de integridad, API keys, API logins, secretos de
  webhook, secretos de firma y números de cuenta no se devuelven al navegador.
- La respuesta administrativa solo informa si cada secreto ya está
  configurado.
- Un campo secreto vacío conserva el valor existente; escribir uno nuevo lo
  reemplaza.
- La configuración pública continúa excluyendo todas las credenciales y ahora
  también oculta la revisión interna de Pagos.
- Los campos internos históricos de firma PayU se conservan aunque no sean
  editables desde la pantalla.

## Reglas de activación

| Proveedor | Datos obligatorios |
| --- | --- |
| Wompi | llave pública, llave privada y llave de integridad; secreto adicional si el webhook está activo |
| PayU | Merchant ID, Account ID, API Login y API Key |
| Pago manual | titular, banco o billetera, número de cuenta e instrucciones para el cliente |

Una configuración incompleta puede permanecer desactivada como borrador. Para
activar pagos, el servidor vuelve a validar todos los datos y devuelve errores
por campo. El checkout y la creación de órdenes usan la misma lista canónica de
proveedores y las mismas exigencias de credenciales.

## Límites del módulo

- Pagos define el canal de cobro y su experiencia en checkout.
- La emisión de facturas, DIAN, Factus, resoluciones, impuestos y documentos
  fiscales continúan exclusivamente en **Facturación**.
- La conciliación, confirmación manual y operación diaria de pagos permanece en
  los módulos operativos correspondientes.

## Validación local

```bash
npm --prefix backend run test:configuration-level-plus-stage2
npm --prefix backend run test:payment-configuration-authority
npm --prefix backend run test:payment-route-composition
npm --prefix frontend run test:configuration-level-plus-stage2
npm --prefix frontend run build
```

El workflow `Configuracion CI` ejecuta esta etapa junto con las Etapas 0 y 1,
las pruebas de pagos existentes y la validación de envíos.
