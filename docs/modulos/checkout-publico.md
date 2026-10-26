# Finalización de compra

El checkout público conserva su ruta fija `/checkout`, la creación autorizada desde el carrito, la validación estricta de disponibilidad, la versión y huella del carrito y la idempotencia del servidor. El diseño y su editor administrativo comparten un único contrato de apariencia.

## Apariencia y edición

`checkoutPageConfig.js` normaliza `checkoutPageConfig` para el editor, la página y la vista previa. Conserva los ajustes existentes y las extensiones desconocidas, incluidos los estilos de campos, etiquetas, resumen y botones que antes no tenían efecto en la página pública. Los controles están organizados en Contenido, Diseño, Opciones y Ajustes, con secciones plegables y vista previa fija.

`CheckoutMaterial` reutiliza `CartGlass` y `PolishedGlassRim`: paneles y acciones sobre un fondo continuo de Inicio o un fondo propio de escritorio/móvil. El footer hereda el fondo de la página. En móvil, la herencia consulta el fondo activo de Inicio cuando el recorrido compartido está desactivado; no impone su imagen guardada de escritorio. Inicio vuelve a leer los fondos responsive al cambiar de tamaño o reemplazar secciones. El tinte, opacidad, desenfoque, borde, reflejo, colores, formas y medidas son administrables. El resumen queda fijo al desplazarse en escritorio y ocupa el flujo normal en móvil; al ocultarlo, el formulario aprovecha una columna centrada. Las animaciones respetan movimiento reducido.

La vista previa ejecuta los mismos componentes públicos con datos de demostración para compra física, digital y carrito vacío. Sus acciones no cotizan, crean órdenes, consultan saldos ni abren pasarelas reales. Las imágenes de título y métodos de pago solo se cargan desde el equipo mediante el flujo administrativo de Cloudinary; no se solicitan URL. Los métodos de pago tienen una alternativa importada por Vite, utilizable también en producción.

## Correcciones de funcionamiento

- Cada cotización se vincula a los productos, cantidades, variantes, ubicación, identidad, cupón, saldo solicitado y moneda correspondientes. Los cambios invalidan el resultado anterior antes de que pueda habilitar el pago. La solicitud comienza después del debounce; las anteriores se cancelan y no reemplazan respuestas nuevas.
- Un fallo no conserva una cotización anterior ni acepta el precio incluido en una respuesta de error. Se bloquea el pago y se ofrece reintentar manteniendo el formulario. Los cambios de documento también generan una nueva cotización.
- El resumen utiliza el envío original y el descuento de envío del resultado del servidor. La suma coincide con el envío final y el total verificado; el color del valor total ahora respeta su control independiente.
- Las consultas de saldo se cancelan o descartan si cambia la identidad del comprador o la moneda. Un resultado anterior no selecciona saldo para otra persona.
- Un bloqueo síncrono evita dos envíos de la acción de compra en el mismo turno. Se mantienen las precondiciones atómicas y el identificador de idempotencia de la creación del pedido.
- Los métodos con flujo implementado son Wompi, PayU y manual. Otros proveedores no crean una orden desde una pantalla que todavía no puede iniciar su pago.
- El teléfono está disponible también para compras digitales o retiro. Sin dirección de envío utilizable, se solicita una dirección fiscal independiente cuando se requieren datos fiscales. Los títulos de contacto y entrega se pueden ocultar; los campos necesarios para crear el pedido permanecen accesibles.
- La apariencia, los medios de pago y la geografía tienen estados de carga y recuperación. Los fallos de países, departamentos o ciudades se informan con reintento y bloquean continuar hasta recuperar los datos. El contenido ya escrito se conserva.
- Las etiquetas se asocian a sus campos; el título y las imágenes tienen alternativas ante fallos de carga. Se conservan cantidades y precios alternativos cuando el campo principal es nulo y se respeta un importe de línea explícitamente cero.

## Verificación y alcance

`test:checkout-module` verifica el contrato de apariencia, la recuperación de configuración y geografía, las cotizaciones obsoletas, la cancelación de consultas de saldo, la concurrencia del botón, el renderizado, el editor, las cargas y el guardado verificado. `test:pages-module` incorpora estas comprobaciones para cubrir regresiones entre las páginas públicas y sus editores.

La auditoría de navegador usa App y el iframe reales con respuestas controladas: 320–1440 px, ausencia de desbordamiento, fondo móvil fijo, footer continuo, resumen fijo, recuperación de cotización/ubicación, creación simulada de una orden manual, carga de imagen, guardado, recarga y aislamiento de la vista previa. Se revisan además los contratos existentes de seguridad, arquitectura, saldo a favor y venta integral. No se realizan cobros, escrituras de pedidos a MongoDB ni cargas reales a Cloudinary en estas pruebas.
