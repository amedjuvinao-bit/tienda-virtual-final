# Órdenes · Antifraude y políticas avanzadas de devolución

## Objetivo

Este bloque amplía la posventa ya cerrada sin rehacer el RMA. Añade prevención de abuso, revisión humana y políticas diferenciadas por tipo de venta o producto. Todo lo incluido puede validarse localmente; no depende de alojar la aplicación, contratar transportadoras ni usar cuentas productivas.

## Controles antifraude

La política global permite activar y ajustar:

- días de historial analizado;
- solicitudes acumuladas que disparan revisión;
- límite crítico de solicitudes del autoservicio;
- unidades e importe acumulados que requieren revisión;
- devoluciones rechazadas o canceladas acumuladas;
- revisión por identidad incompleta;
- revisión de excepciones a la política.

La evaluación ocurre dentro del servicio transaccional que crea el RMA. Una solicitud sin señales queda `clear` y puede autoautorizarse si la política general lo permite. Una señal produce `manual_review`; el administrador debe documentar su conclusión antes de autorizar. Un límite crítico bloquea el autoservicio con una respuesta genérica y, si el caso es registrado por un administrador, lo mantiene en revisión manual.

El panel administrativo sí muestra nivel, puntuación, motivos e historial agregado. La página del cliente nunca recibe `riskAssessment`, señales, umbrales ni conteos. Solo informa si la política aplicable requiere una revisión del equipo.

## Políticas diferenciadas

Hasta treinta reglas versionadas pueden aplicarse por prioridad a:

1. categoría;
2. producto o SKU;
3. canal/mercado (`web`, `pos`, `manual`, entre otros);
4. condición comercial o etiqueta de la orden.

La primera regla coincidente define:

- si el producto admite devolución;
- ventana entre 1 y 365 días;
- reembolso, cambio o saldo a favor disponibles;
- explicación obligatoria del cliente;
- revisión administrativa obligatoria;
- quién asume el transporte de retorno.

La elegibilidad se calcula por línea, no solo por orden. Un RMA de varios productos conserva la regla aplicada a cada línea y usa la fecha de vencimiento más próxima. Una resolución debe estar permitida por todas las líneas seleccionadas.

## Experiencia del administrador

En `Orden → Posventa → Configurar política` aparecen dos bloques didácticos:

- **Protección antifraude**, con nombres explícitos para cada umbral;
- **Políticas especiales**, con tarjetas editables, prioridad, alcance, decisión y soluciones.

Un expediente con alerta muestra sus señales antes de los botones de operación. `Autorizar` permanece deshabilitado hasta que el administrador escriba la conclusión de su revisión. Los estilos usan exclusivamente `ORDER_DETAIL_THEME` y variables del tema administrativo.

## Seguridad y trazabilidad

- La configuración mantiene `settings:store`, revisión optimista y la ruta administrativa existente.
- Las operaciones RMA mantienen alcance por sede y `orders:returns`.
- La autorización registra fecha, actor y nota de revisión.
- Las señales se guardan como snapshot del momento de la solicitud.
- El cliente no puede omitir reglas, conocer umbrales ni autorizarse.
- El límite de cantidades compradas, la inspección física, el inventario y la conciliación financiera conservan sus contratos anteriores.

## Prueba manual local

1. Abrir una orden entregada y entrar en `Posventa`.
2. Pulsar `Configurar política`.
3. Activar antifraude y bajar temporalmente `Revisar desde solicitudes` a `1`.
4. Agregar una política especial para una categoría o SKU real de la orden y elegir `Exigir revisión manual`.
5. Guardar la política y crear un RMA de esa línea.
6. Verificar que el expediente muestra `Revisión antifraude requerida`.
7. Confirmar que `Autorizar` está deshabilitado hasta escribir una conclusión.
8. Autorizar, recargar y comprobar que la revisión queda aprobada y el recorrido RMA continúa normalmente.
9. Restaurar los umbrales deseados al terminar la prueba.

## Puertas de validación

- `node backend/scripts/testOrderReturnRiskPolicy.js`;
- `ORDERS_RETURN_RISK_MONGO_URI=mongodb://127.0.0.1:27017/orders_ci_return_risk?replicaSet=rs0 node backend/scripts/testOrderReturnRiskIntegration.js` dentro de CI con MongoDB temporal;
- `node backend/scripts/testOrdersStage4Closure.js`;
- pruebas React del panel Posventa y del portal del cliente;
- contratos RMA previos;
- build de producción del frontend;
- revisión de que no existe commit ni publicación no autorizados.

## Estado

Implementación local preparada y validada. No se creó commit y no se publicó la rama.
