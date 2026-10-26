# Página de agradecimiento y resultado del pedido

La ruta fija `/gracias` conserva la verificación protegida de pedidos y pagos. El editor administrativo usa el espacio de trabajo común de páginas: Contenido, Diseño, Opciones y Ajustes, con secciones plegables, borrador protegido, guardado verificado y vista previa fija.

## Configuración y presentación

`pages/gracias/thanksPageConfig.js` es el único normalizador usado por el editor, la página pública y la vista previa. Conserva la estructura existente de `thanksPageConfig`, sus colores y medidas guardadas y extensiones desconocidas. No cambia pedidos ni ajustes globales. `presentation` reutiliza el contrato de material del carrito: continuidad con Inicio o fondo propio para escritorio/móvil, tinte, opacidad, desenfoque, grosor del borde, reflejo y material de los botones. El pie comparte el fondo continuo, sin superponer su imagen propia.

La página usa el mismo `CartGlass` y `PolishedGlassRim` que las páginas públicas actualizadas. Sin galería, el resumen ocupa una sola columna centrada. Sin imágenes, aparece un símbolo neutro en lugar de una fotografía predefinida para un tipo de negocio. Las imágenes rotas tienen alternativa; título, medidas, etiquetas, visibilidad y acciones se editan desde temas agrupados. El selector de imágenes solo permite cargar archivos del equipo por el flujo administrativo de Cloudinary.

La galería admite hasta veinte imágenes, orden, texto alternativo, etiqueta, descripción, transiciones y reproducción automática. Respeta movimiento reducido, pausa manual y pestañas ocultas. Se bloquean guardar, eliminar y reordenar durante una carga activa.

## Autoridad y recuperación

`useThanksVerification` consulta los endpoints existentes de resumen y transacción con las cabeceras de acceso firmado. Los parámetros de URL y el estado del navegador solo identifican qué consultar: nunca establecen aprobación, comprador o importes. Las consultas se cancelan al salir y los resultados se vinculan a su pedido para descartar respuestas anteriores.

Una visita sin pedido no muestra éxito ni cifras ficticias. Los estados pendientes, desconocidos y no verificados no usan un icono de aprobación. El subtotal y el envío proceden del resumen protegido: una respuesta exclusiva de transacción no inventa envío gratuito. Un total protegido de cero conserva su valor. Las caídas de red permiten reintentar y los estados pendientes o desconocidos se pueden actualizar desde la página; la apariencia tiene carga, cancelación y recuperación independientes del pedido. Desactivar el diseño personalizado mantiene disponible la consulta protegida con la presentación básica.

Las etiquetas y el mensaje para un pago aprobado son configurables. Los títulos y explicaciones de estados pendientes, rechazados, expirados y sin verificar describen la respuesta validada; los controles visuales no pueden convertirlos en aprobados. Los cambios y devoluciones solo se abren con el acceso emitido por el servidor.

## Verificación

`test:thanks-module` comprueba normalización y migración sin pérdida de extensiones, renderizado real, estados protegidos, consultas canceladas, recuperación de red, borrador, cargas de imágenes y verificación de guardado. También se ejecutan las pruebas de arquitectura de checkout, la suite de páginas y compilación de producción.

La auditoría con navegador usa la ruta real de App y el iframe real del editor con respuestas controladas: 320–1440 px, ausencia de desbordamiento, fondo móvil fijo, footer continuo, galería, estados del pago, parámetros manipulados, recuperación, carga de archivo, guardado y recarga. La vista previa permite simular resultados sin consultar pedidos ni modificar carritos o pagos reales. Estas pruebas no realizan cobros, escrituras a MongoDB ni cargas reales a Cloudinary.
