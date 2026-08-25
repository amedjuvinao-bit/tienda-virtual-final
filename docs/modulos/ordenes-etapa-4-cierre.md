# Cierre de Órdenes · Etapa 4

## Objetivo

La Etapa 4 completa el recorrido Plus de cambios y devoluciones alrededor del RMA existente. El cliente puede abrir una solicitud segura desde su compra, consultar el estado y obtener la etiqueta disponible; el administrador conserva la autoridad sobre recepción, inspección, inventario y resolución financiera.

Esta etapa no reemplaza la conciliación de reembolsos ni la logística ya cerradas. Las conecta mediante una política versionada y añade dos resoluciones trazables: **Saldo a favor** y **Cambio automático**.

## Portal de autoservicio

- La página pública vive en `/devoluciones/:orderId` y hereda los colores del tema con variables CSS.
- El acceso se emite desde la respuesta protegida de la página de agradecimiento.
- La credencial está firmada, expira, pertenece a una sola orden y viaja en `X-Order-Return-Token`.
- Un acceso inválido devuelve un error genérico y no permite descubrir si una orden o un RMA existen.
- El cliente solo puede pedir cantidades entregadas, disponibles y dentro de la ventana configurada.
- El cliente no puede omitir la política ni ejecutar recepción, inspección, reembolso o movimientos de inventario.
- Una etiqueta HTTPS real de la transportadora se abre directamente; cuando no existe, se genera un PDF interno que identifica el RMA y no finge ser una guía comprada.
- Cuando una resolución exige nota crédito, el comprador fiscal se toma del snapshot inmutable de la factura original. Los cambios posteriores en la orden no pueden sustituirlo por consumidor final ni por otra identidad.

## Política versionada

El panel `Orden → Posventa` permite consultar la política. Un usuario con `settings:store` puede editar:

- activación general y del portal del cliente;
- ventana de devolución;
- resoluciones disponibles;
- detalle obligatorio del motivo;
- autoautorización;
- responsable del transporte de retorno;
- instrucciones y texto visible;
- vigencia del saldo a favor;
- habilitación del cambio automático.

Cada guardado exige `expectedRevision`. Si otra persona modificó la política, el segundo guardado falla con conflicto y obliga a recargar.

## Saldo a favor

Después de recibir e inspeccionar la mercancía, un usuario con `orders:refund` puede emitir saldo por un valor mayor a cero y nunca superior al valor aceptado. `StoreCredit` conserva cliente, moneda, valor original, saldo, vencimiento, orden, RMA y actor.

La operación es transaccional e idempotente: el mismo RMA no puede generar dos saldos. Esta etapa cubre la **emisión y trazabilidad desde Órdenes**; el consumo del saldo en un checkout futuro pertenece al módulo de pagos/checkout y no se presenta aquí como disponible.

## Cambio automático

Después de la inspección, un usuario con `orders:returns` puede crear la orden de cambio desde el RMA. La orden nueva:

- copia las unidades aceptadas y su identidad de producto/variante;
- tiene total cero y queda marcada como orden del sistema;
- conserva la relación con la orden original y el RMA;
- usa el servicio oficial de reservas;
- confirma la reserva y descuenta el inventario disponible;
- no se duplica si la solicitud se repite.

El enlace manual de una orden de reemplazo existente se conserva como alternativa dentro de los detalles avanzados.

## Matriz de aceptación

| Caso | Comportamiento exigido | Evidencia |
|---|---|---|
| Acceso del cliente | Credencial firmada, con vencimiento y limitada a la orden | Contrato y pruebas unitarias |
| Solicitud | Cantidad, motivo y resolución respetan entrega y política | Unitarias, E2E e integración |
| Política | Persistencia global y conflicto por revisión | Contrato e integración |
| Recepción | Solo el administrador confirma el paquete recibido | Servicio RMA existente |
| Inspección | Cada unidad queda clasificada exactamente una vez | Regresión RMA e integración |
| Saldo a favor | Un solo crédito, acotado al valor aceptado | Integración transaccional |
| Cambio | Una sola orden nueva con reserva confirmada | Integración transaccional |
| Etiqueta | Guía HTTPS real o identificador RMA interno, sin simulación | Unitarias y portal |
| Tema | Sin colores fijos para identidad principal | Contrato visual y build |

## Seguridad y aislamiento

- Las rutas administrativas conservan `requireAdmin`, alcance por sede y RBAC.
- `settings:store` edita la política; `orders:returns` opera la pieza física; `orders:refund` emite saldo.
- Las rutas de autoservicio no reutilizan el token administrativo ni el token de pago como cabecera de operación.
- La integración exige `ORDERS_STAGE4_MONGO_URI`, host `127.0.0.1` o `localhost`, base exacta `orders_ci_stage4_returns` y `replicaSet=rs0`.
- La prueba no acepta Atlas, no lee `MONGODB_URI`, no llama pagos, DIAN, correo o transportadoras y elimina exclusivamente su base temporal.
- El E2E intercepta toda ruta `/api/` y usa datos `.invalid`.

## Prueba manual

1. Crear o abrir una orden entregada que conserve inventario trazable.
2. Abrir la página de agradecimiento y pulsar `Gestionar cambios o devoluciones`.
3. Seleccionar una unidad, indicar el motivo y enviar la solicitud.
4. Volver a `Administración → Órdenes`, abrir la orden y entrar en `Posventa`.
5. Autorizar si la política no autoautoriza, recibir e inspeccionar la unidad.
6. Resolver una prueba con `Emitir saldo a favor` o `Crear orden de cambio`.
7. Recargar y comprobar que no aparece un segundo saldo ni una segunda orden.

No debe usarse una compra real, una guía con costo ni una base productiva para esta verificación local.

## Puertas de cierre

- contrato `test:orders-stage4-closure`;
- contratos previos de seguridad, arquitectura y RMA;
- pruebas React de acceso, portal, política y resoluciones;
- integración MongoDB transaccional aislada;
- build de producción;
- E2E Playwright del autoservicio;
- **Órdenes CI** verde después de una publicación autorizada.

## Estado local

Implementación preparada localmente y **sin publicación**. La etapa solo se considerará cerrada remotamente cuando el usuario autorice el commit y GitHub ejecute todas las puertas en verde.
