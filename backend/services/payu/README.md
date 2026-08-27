# Operación segura de PayU

## Cambio del proveedor activo

Un intento PayU pendiente puede recibir su confirmación aunque la tienda haya
cambiado el proveedor activo a Wompi. El webhook valida la firma con la
configuración PayU conservada y compara comercio, referencia, moneda e importe
contra el intento persistido.

## Rotación de la API key

`PaymentAttempt` guarda únicamente una huella del `merchantId:accountId`; no
guarda la API key ni derivados de ese secreto. Por ello, la API key anterior se
debe conservar en el gestor seguro de credenciales hasta que todos los intentos
PayU emitidos con ella alcancen un estado terminal o se concilien.

Si la clave se elimina o rota antes, una confirmación pendiente firmada con la
clave anterior será rechazada. No se debe aceptar el evento sin firma ni probar
claves no identificadas automáticamente: el pago debe pasar a conciliación
operativa con evidencia del proveedor.
