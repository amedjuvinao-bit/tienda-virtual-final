# Efectos post-pago en Órdenes

## Orquestación común

Wompi, PayU, la confirmación manual y el pago completo con saldo a favor usan
el mismo orquestador post-commit. La identidad del reclamo queda ligada a la
orden, proveedor y transacción aprobada tanto en `payment` como en
`paymentProcessing`; un worker de una transacción vieja no puede finalizar el
claim de otra transacción.

La entrega y la factura son carriles independientes. La factura siempre se
ejecuta con `processFulfillment: false`, de modo que un fallo de entrega no queda
absorbido dentro del claim fiscal ni impide intentar la factura.

## Pago completo con saldo a favor

La creación de la orden, la confirmación de inventario y el consumo del saldo
ocurren en la transacción principal. La suscripción al boletín se ejecuta después
del commit mediante un `upsert`; una dirección ya suscrita o una carrera sobre el
índice único no puede abortar una compra válida.

Cada efecto conserva en `Order.paymentProcessing` su estado, identificador de
claim, fecha de reclamo y resultado:

- `fulfillment`: `pending`, `processing`, `completed`, `not_required` o `failed`.
- `invoice`: `pending`, `scheduling`, `scheduled`, `not_required` o `failed`.

Un replay autorizado vuelve a reclamar únicamente efectos pendientes, fallidos
o claims abandonados por más de diez minutos. Además, cada réplica del backend
ejecuta un worker acotado que consulta este outbox embebido en lotes; todas las
réplicas pueden observar la misma orden, pero los claims atómicos de MongoDB
permiten que solo una ejecute cada carril. En Wompi y PayU, un efecto
reintentable responde temporalmente al webhook con `503`; el replay exacto no
repite el hecho financiero y solo redirige los carriles pendientes. La
confirmación manual y la creación idempotente con saldo completo hacen el mismo
redrive al repetir su solicitud segura.

Los efectos completados no se repiten. La preparación de datos de entrega y la
emisión de factura son idempotentes por orden. La notificación por correo usa
entrega al menos una vez: conserva `notificationClaimId` y todas sus
finalizaciones quedan cercadas por ese token, por lo que un worker cuyo lease
venció no puede sobrescribir el resultado del sucesor. Como en cualquier correo
sin idempotencia ofrecida por el proveedor, una caída exactamente después de
enviar y antes de guardar el resultado todavía podría ocasionar un reenvío.

## Operación del worker

El worker se inicia únicamente después de conectar MongoDB, su temporizador usa
`unref`, no solapa ciclos dentro de una réplica y ofrece `start/stop`
idempotentes para pruebas y apagado controlado. Se configura mediante:

- `ORDER_POST_COMMIT_OUTBOX_ENABLED`;
- `ORDER_POST_COMMIT_OUTBOX_INTERVAL_MS`;
- `ORDER_POST_COMMIT_OUTBOX_BATCH_SIZE`.

Los índices `orders_postcommit_fulfillment_recovery` y
`orders_postcommit_invoice_recovery` evitan recorrer el historial completo. Su
migración es segura por defecto en modo dry-run y se aplica explícitamente con
`migrate:order-postcommit-indexes`.
