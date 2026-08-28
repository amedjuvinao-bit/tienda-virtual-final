# Órdenes Plus · Etapa 1 · Logística inversa RMA

## Estado verificable

La implementación está publicada en la rama de desarrollo y sus contratos automatizados están en verde. Todavía no se declara certificada en Producción. El cierre de la etapa exige ejecutar una traza real en Envia Sandbox con las credenciales y el webhook del entorno de staging.

## Contrato funcional

La devolución automática es una operación distinta del despacho de venta:

- origen: dirección histórica del cliente en la orden;
- destino: sede activa que participó en el recorrido original de la orden;
- autoridad física: `OrderReturn`;
- autoridad de llamadas externas: `ShippingOperation` con `scope: return`;
- deduplicación de eventos: `ShippingWebhookEvent`;
- concurrencia: `OrderReturn.revision`, actualización atómica y bloqueo único de operación externa activa por RMA;
- permiso: `orders:returns` con acceso completo a la orden multisede.

La capa bloquea datos incompletos, paquetes sin peso o dimensiones, una sede ajena a la orden y devoluciones internacionales sin gestión aduanera. No inventa pesos, direcciones o declaraciones. La política `returnShippingPaidBy` se respeta: una devolución pagada por el cliente no puede consumir saldo de la tienda y `case_by_case` exige confirmación explícita. Producción añade una segunda confirmación antes de generar, recoger o cancelar una guía real.

## Estados y recepción

`Picked Up`, `Shipped` e `In Transit` pueden mover un RMA autorizado a `in_transit`. `Delivered` solo significa que la transportadora reportó llegada a la sede: activa `awaitingWarehouseReceipt`, pero no cambia el RMA a `received`, no repone inventario y no habilita reembolso. Bodega conserva la obligación de confirmar las cantidades físicas.

Si Envia responde y la persistencia local no termina, la operación queda `action_required` con la respuesta externa guardada. El mismo intento y la misma clave idempotente concilian el resultado sin comprar otra guía. Una clave usada con otro RMA, proveedor, operación o payload responde conflicto.

Dos administradores tampoco pueden comprar guías o ejecutar acciones externas simultáneas con claves distintas: el índice parcial único de `ShippingOperation.activeLock` permite una sola operación externa activa por RMA. Además, una recolección confirmada no puede convertirse después en entrega en punto, ni viceversa, y una guía reportada como entregada ya no puede cancelarse.

## API administrativa

| Endpoint | Acción |
|---|---|
| `POST /api/orders/:id/returns/:returnId/shipping/rates` | Cotizar cliente → sede |
| `POST /api/orders/:id/returns/:returnId/shipping/label` | Generar guía idempotente |
| `POST /api/orders/:id/returns/:returnId/shipping/tracking/sync` | Consultar seguimiento |
| `POST /api/orders/:id/returns/:returnId/shipping/pickup` | Solicitar recolección idempotente |
| `POST /api/orders/:id/returns/:returnId/shipping/handoff/dropoff` | Confirmar entrega en punto |
| `POST /api/orders/:id/returns/:returnId/shipping/label/cancel` | Cancelar y conciliar saldo |

Todos exigen `orders:returns`. Generar, recoger y cancelar exigen `Idempotency-Key`.

## Persistencia e índices

`OrderReturn.shipping` conserva sede receptora y snapshot, paquetes, proveedor, ambiente, tarifa, identificador externo, etiqueta HTTPS, tracking, recolección, cancelación y aviso de llegada. Los documentos antiguos mantienen los campos manuales compatibles.

Antes del despliegue deben revisarse y aplicarse dos migraciones no destructivas:

- `migrate:order-return-indexes`: añade la búsqueda parcial por guía RMA;
- `migrate:shipping-operation-indexes`: añade la consulta histórica por RMA y el bloqueo parcial único de su operación externa activa.

El dry-run conjunto reporta nueve migraciones y cero escrituras.

## Evidencia automatizada local

- `test:orders-return-shipping`: ruta invertida, bloqueo internacional, semántica de `Delivered`, idempotencia de guía y enrutamiento del webhook RMA;
- `test:orders-return-shipping-integration`: 30 intentos simultáneos sobre MongoDB replica set y un solo ganador externo;
- contratos RMA, Envia, logística de órdenes, composición, índices y arquitectura CommonJS;
- pruebas React de cotización/generación y reutilización de clave tras fallo de red;
- compilación Vite de Producción.

Estas pruebas no sustituyen la llamada real a Envia Sandbox.

## Comprobación oficial del webhook Sandbox

El botón **Probar** del portal de Envia solo comprueba que la URL responde; esa respuesta no demuestra que la tienda haya recibido un evento autenticado. La prueba aceptada por el panel se solicita desde **Configuración → Envíos → Enviar prueba oficial desde Envia**. El backend llama al endpoint oficial `POST /ship/webhooktest/` con `tracking_number` y `webhook_url`; Envia realiza después un POST externo a la URL registrada usando la autorización Bearer de Sandbox.

La tienda responde rápidamente y procesa el evento de forma asíncrona, pero solo marca el webhook como verificado si la autorización coincide con una credencial configurada y el payload contiene transportadora, guía y estado. Una visita GET, el botón de conectividad del portal o un POST sin credenciales nunca completan el control.

La solicitud oficial reintenta como máximo tres veces los errores temporales `500`, `502`, `503` y `504` de Envia. Los rechazos de autenticación o validación no se reintentan. Si el proveedor continúa fallando, el panel conserva la operación manual, no marca la URL como verificada y muestra un diagnóstico para soporte.

Para los eventos reales se debe registrar el tipo firmado `tracking.simple` (`type_id: 3`). Los tipos heredados `onShipmentStatusUpdate` y `statusUpdateWithEcommerceInfo` no incluyen firma HMAC y no son aptos para certificar Producción.

## Puerta de cierre en staging

1. Ejecutar el dry-run y aplicar los dos índices con las confirmaciones documentadas.
2. Confirmar token válido, registrar un webhook firmado `tracking.simple` y solicitar desde el panel la prueba oficial para la URL pública de staging.
3. Crear una orden de prueba con dirección realista, sede operativa y paquete medido; autorizar su RMA.
4. Cotizar y generar una guía Sandbox desde Posventa. Verificar etiqueta, guía, proveedor, tarifa y una sola `ShippingOperation` exitosa.
5. Probar recolección o entrega en punto según las capacidades de la transportadora.
6. Recibir eventos Sandbox hasta `Delivered`; comprobar que el RMA sigue pendiente de recepción física.
7. Registrar recepción e inspección desde bodega y comprobar que solo entonces continúa la resolución comercial.
8. Repetir una solicitud con la misma clave y confirmar que Envia no genera una segunda guía.
9. Probar cancelación y verificar su estado de devolución de saldo.

Solo después de esa evidencia la etapa puede marcarse cerrada y prepararse para publicación controlada.
