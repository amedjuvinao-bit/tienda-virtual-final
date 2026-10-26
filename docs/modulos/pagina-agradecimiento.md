# Página de agradecimiento y resultado del pedido

La ruta fija `/gracias` conserva la verificación protegida de pedidos y pagos. El editor administrativo usa el espacio de trabajo común de páginas: Contenido, Diseño, Opciones y Ajustes, con secciones plegables, borrador protegido, guardado verificado y vista previa fija.

## Configuración y presentación

`pages/gracias/thanksPageConfig.js` es el único normalizador usado por el editor, la página pública y la vista previa. Conserva la estructura existente de `thanksPageConfig`, sus colores y medidas guardadas y extensiones desconocidas. No cambia pedidos ni ajustes globales. `presentation` reutiliza el contrato de material del carrito: continuidad con Inicio o fondo propio para escritorio/móvil, tinte, opacidad, desenfoque, grosor del borde, reflejo y material de los botones. El pie comparte el fondo continuo, sin superponer su imagen propia.

La página usa el mismo `CartGlass` y `PolishedGlassRim` que las páginas públicas actualizadas. La composición central aprobada es la presentación predeterminada: un panel de cristal con símbolo de estado flotante, título editorial, etiqueta verificable del pago, tres datos compactos (pedido, cantidad y total), próximos pasos y acciones. No requiere fotografías. La galería puede activarse debajo del panel; no desplaza el resumen a una columna lateral. Las imágenes rotas tienen alternativa; título, medidas, etiquetas, visibilidad y acciones se editan desde temas agrupados. El selector de imágenes solo permite cargar archivos del equipo por el flujo administrativo de Cloudinary.

La galería admite hasta veinte imágenes, orden, texto alternativo, etiqueta, descripción, transiciones y reproducción automática. Respeta movimiento reducido, pausa manual y pestañas ocultas. Se bloquean guardar, eliminar y reordenar durante una carga activa.

## Autoridad y recuperación

`useThanksVerification` consulta los endpoints existentes de resumen y transacción con las cabeceras de acceso firmado. Los parámetros de URL y el estado del navegador solo identifican qué consultar: nunca establecen aprobación, comprador o importes. Las consultas se cancelan al salir y los resultados se vinculan a su pedido para descartar respuestas anteriores.

Una visita sin pedido no muestra éxito ni cifras ficticias. Los estados pendientes, desconocidos y no verificados no usan un icono de aprobación. El subtotal y el envío proceden del resumen protegido: una respuesta exclusiva de transacción no inventa envío gratuito. Un total protegido de cero conserva su valor. Las caídas de red permiten reintentar y los estados pendientes o desconocidos se pueden actualizar desde la página; la apariencia tiene carga, cancelación y recuperación independientes del pedido. Desactivar el diseño personalizado mantiene disponible la consulta protegida con la presentación básica.

El título central es configurable para pagos pendientes y aprobados. Los estados rechazado, expirado, desconocido y sin verificar mantienen sus explicaciones correspondientes. La etiqueta del estado siempre procede de la verificación protegida; un título personalizado no convierte un pago en aprobado. Una visita directa sin pedido usa un título neutro propio. Los cambios y devoluciones solo se abren con el acceso emitido por el servidor.

## Verificación

`test:thanks-module` comprueba normalización y migración sin pérdida de extensiones, renderizado real, estados protegidos, consultas canceladas, recuperación de red, borrador, cargas de imágenes y verificación de guardado. También se ejecutan las pruebas de arquitectura de checkout, la suite de páginas y compilación de producción.

La auditoría con navegador usa la ruta real de App y el iframe real del editor con respuestas controladas: 320–1440 px, ausencia de desbordamiento, fondo móvil fijo, footer continuo, galería, estados del pago, parámetros manipulados, recuperación, carga de archivo, guardado y recarga. La vista previa permite simular resultados sin consultar pedidos ni modificar carritos o pagos reales. Estas pruebas no realizan cobros, escrituras a MongoDB ni cargas reales a Cloudinary.


## Composición central (versión 2)

`designVersion: 2` identifica la adopción del diseño central. La normalización actualiza una sola vez los antiguos tamaños y colores predeterminados, conserva colores propios y extensiones, y oculta la galería antigua sin eliminar sus imágenes. Al guardar se persiste la configuración normalizada. La galería se puede reactivar desde su pestaña y aparece debajo del panel. Los valores guardados en versión 2 no se vuelven a migrar.

`ThanksOrderFacts` presenta el número de pedido, la cantidad y el total protegido, incluido un total de cero. El cliente, el subtotal, el envío, el estado y el saldo a favor permanecen disponibles en el detalle desplegable según sus controles de visibilidad. No se repite el nombre del cliente dentro del título principal.

`ThanksNextSteps` describe confirmación, preparación y entrega. Solo la primera etapa refleja el pago verificado; aprobar el pago no demuestra preparación o despacho y las otras etapas permanecen futuras. No se muestra este bloque durante la verificación ni sin un pedido autorizado. Los estados con problemas muestran atención en el primer paso. El bloque se apila en móvil sin barras internas de desplazamiento.

La pestaña Próximos pasos agrupa sus textos y visibilidad. Diseño contiene tipografía editorial local/global/de lectura, ancho del panel, diámetro del símbolo y de los pasos, separadores, colores del estado, botones principal y secundario, y material de cristal. Los controles de grosor y reflejo se respetan sin imponer un borde mínimo. La tipografía editorial usa un archivo local existente; no requiere Google Fonts.

Verificación de esta entrega: 64 pruebas en 18 archivos de frontend y compilación de producción aprobadas. Siete recorridos de navegador con API controlada comprueban estados protegidos, apariencia entre 320 y 1536 px, símbolo centrado, fondo móvil y pie continuo, detalle, actualización, accesos inválidos, vista previa sin operaciones, guardado/recarga, conservación de imágenes antiguas y controles de diseño. No se ejecutaron pagos reales ni escrituras en MongoDB.
