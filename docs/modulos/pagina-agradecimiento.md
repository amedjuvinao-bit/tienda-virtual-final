# Página de agradecimiento y resultado del pedido

La ruta fija `/gracias` conserva la verificación protegida de pedidos y pagos. El editor administrativo usa el espacio de trabajo común de páginas: Contenido, Diseño, Opciones y Ajustes, con secciones plegables, borrador protegido, guardado verificado y vista previa fija.

## Configuración y presentación

`pages/gracias/thanksPageConfig.js` es el único normalizador usado por el editor, la página pública y la vista previa. Conserva el contenido, las imágenes y las extensiones de `thanksPageConfig`. La adopción del diseño aprobado aplica sus medidas, tipografía, paleta y material como un conjunto; después de guardarlo, los nuevos ajustes del usuario se conservan sin volver a aplicar el preset. No cambia pedidos ni ajustes globales. `presentation` reutiliza el contrato de material del carrito: continuidad con Inicio o fondo propio para escritorio/móvil, tinte, opacidad, desenfoque, grosor del borde, reflejo y material de los botones. El pie comparte el fondo continuo, sin superponer su imagen propia.

La página comparte las variables y la superficie de `CartGlass` con las páginas públicas actualizadas. `ThanksGlassRim` mide cada superficie y dibuja un bisel vectorial propio, con iluminación limitada al perímetro. La composición central aprobada es la presentación predeterminada: un panel de cristal con símbolo de estado flotante, título editorial, etiqueta verificable del pago, tres datos compactos (pedido, cantidad y total), próximos pasos y acciones. No requiere fotografías. La galería puede activarse debajo del panel; no desplaza el resumen a una columna lateral. Las imágenes rotas tienen alternativa; título, medidas, etiquetas, visibilidad y acciones se editan desde temas agrupados. El selector de imágenes solo permite cargar archivos del equipo por el flujo administrativo de Cloudinary.

La galería admite hasta veinte imágenes, orden, texto alternativo, etiqueta, descripción, transiciones y reproducción automática. Respeta movimiento reducido, pausa manual y pestañas ocultas. Se bloquean guardar, eliminar y reordenar durante una carga activa.

## Autoridad y recuperación

`useThanksVerification` consulta los endpoints existentes de resumen y transacción con las cabeceras de acceso firmado. Los parámetros de URL y el estado del navegador solo identifican qué consultar: nunca establecen aprobación, comprador o importes. Las consultas se cancelan al salir y los resultados se vinculan a su pedido para descartar respuestas anteriores.

Una visita sin pedido no muestra éxito ni cifras ficticias. Los estados pendientes, desconocidos y no verificados no usan un icono de aprobación. El subtotal y el envío proceden del resumen protegido: una respuesta exclusiva de transacción no inventa envío gratuito. Un total protegido de cero conserva su valor. Las caídas de red permiten reintentar y los estados pendientes o desconocidos se pueden actualizar desde la página; la apariencia tiene carga, cancelación y recuperación independientes del pedido. Desactivar el diseño personalizado mantiene disponible la consulta protegida con la presentación básica.

El título central es configurable para pagos pendientes y aprobados. Los estados rechazado, expirado, desconocido y sin verificar mantienen sus explicaciones correspondientes. La etiqueta del estado siempre procede de la verificación protegida; un título personalizado no convierte un pago en aprobado. Una visita directa sin pedido usa un título neutro propio. Los cambios y devoluciones solo se abren con el acceso emitido por el servidor.

## Verificación

`test:thanks-module` comprueba normalización y migración sin pérdida de extensiones, renderizado real, estados protegidos, consultas canceladas, recuperación de red, borrador, cargas de imágenes y verificación de guardado. También se ejecutan las pruebas de arquitectura de checkout, la suite de páginas y compilación de producción.

La auditoría con navegador usa la ruta real de App y el iframe real del editor con respuestas controladas: 320–1440 px, ausencia de desbordamiento, fondo móvil fijo, footer continuo, galería, estados del pago, parámetros manipulados, recuperación, carga de archivo, guardado y recarga. La vista previa permite simular resultados sin consultar pedidos ni modificar carritos o pagos reales. Estas pruebas no realizan cobros, escrituras a MongoDB ni cargas reales a Cloudinary.


## Composición central (versión 3)

`designVersion: 3` identifica la aplicación completa del diseño central aprobado. Las configuraciones anteriores se actualizan de una vez, incluido un ancho personalizado estrecho o un acento muy claro que perjudicaba la lectura de las cifras. Se conservan contenidos, imágenes, extensiones y selección de fondo. La galería queda oculta sin eliminar sus imágenes; puede activarse debajo del panel. Al guardar, se persiste la versión actual y los cambios posteriores de color, ancho o grosor se respetan.

`thanksCentralPreset.js` es la fuente común del preset inicial y del botón Restablecer diseño aprobado, dentro de Diseño → Medidas y formas → Contenido. Restaurar solo modifica el borrador y requiere Guardar cambios para publicarse. El preset establece ancho 1000 px, tipografía editorial, valores burdeos, símbolo flotante, botones y cristal; el color de los valores del resumen tiene un control propio. El bisel ilumina exclusivamente el perímetro y respeta el grosor y reflejo configurados, incluido cero; no agrega un segundo contorno blanco interior.

El resumen usa consultas al ancho del propio panel. Si el usuario lo estrecha en una pantalla de escritorio, los datos y próximos pasos se apilan sin dividir el importe ni las palabras de la cantidad. El dinero omite decimales cuando no hacen falta y conserva los centavos existentes. El mensaje de pago pendiente tiene un control de contenido propio y solo se usa con un resultado pendiente verificado.

`ThanksOrderFacts` presenta el número de pedido, la cantidad y el total protegido, incluido un total de cero. El cliente, el subtotal, el envío, el estado y el saldo a favor permanecen disponibles en el detalle desplegable según sus controles de visibilidad. No se repite el nombre del cliente dentro del título principal.

`ThanksNextSteps` describe confirmación, preparación y entrega. Solo la primera etapa refleja el pago verificado; aprobar el pago no demuestra preparación o despacho y las otras etapas permanecen futuras. No se muestra este bloque durante la verificación ni sin un pedido autorizado. Los estados con problemas muestran atención en el primer paso. El bloque se apila en móvil sin barras internas de desplazamiento.

La pestaña Próximos pasos agrupa sus textos y visibilidad. Diseño contiene tipografía editorial local/global/de lectura, ancho del panel, diámetro del símbolo y de los pasos, separadores, colores del estado, botones principal y secundario, y material de cristal. Los controles de grosor y reflejo se respetan sin imponer un borde mínimo. La tipografía editorial usa un archivo local existente; no requiere Google Fonts.

Verificación de esta entrega: 66 pruebas en 18 archivos de frontend y compilación de producción aprobadas. Ocho recorridos de navegador con API controlada comprueban estados protegidos, apariencia entre 320 y 1536 px, símbolo centrado, fondo móvil y pie continuo, detalle, actualización, accesos inválidos, vista previa sin operaciones, guardado/recarga, conservación de imágenes antiguas y controles de diseño. No se ejecutaron pagos reales ni escrituras en MongoDB.


Regresión reproducida con el código publicado anterior y configuración equivalente a la captura: panel de 640 px, valores `#ffc7e0`, cantidad partida en tres líneas e importe en dos. Con el preset completo, el panel recupera 1000 px y los valores `#74243e`; se comprobaron también un panel estrechado desde el editor, restauración del preset y ausencia de desbordamiento entre 320 y 1536 px con API controlada.


## Bisel de cristal

`ThanksGlassRim` y `thanksLiquidGlass.css` definen el acabado del resumen, medallón, etapas y botones sin modificar el material de otras páginas. El control de grosor regula las dos caras del labio convexo, con un ancho total proporcional de dos veces el valor del control; cero retira el componente completo. La geometría se ajusta al tamaño y al radio reales de cada elemento. El reflejo cero apaga luces y destellos; los colores del brillo y del acento proceden del editor. No se migra ni sustituye la configuración guardada.

El desenfoque se aplica a una superficie interior separada del borde. El bisel usa trazados SVG con luces de intensidad variable, retorno tintado y reflejos de esquina; conserva la superficie central sin pintar y no depende de máscaras rasterizadas para el relieve. Los reflejos puntuales quedan limitados al perímetro. Se retiró el contorno blanco adicional; el trazado del marco queda abierto alrededor del medallón para que ninguna de sus capas atraviese el icono. Esta separación es geométrica y no depende de ocultar el trazo con una máscara CSS. Los botones conservan su animación, foco y relieve al hacer hover.

Verificación del bisel vectorial: 58 pruebas en 16 archivos y compilación de producción aprobadas. Nueve recorridos de navegador con API controlada verifican el diseño entre 320 y 1536 px, las acciones protegidas, la vista previa real, el guardado y recarga de colores, el grosor cero sin contornos residuales, reflejo cero sin destellos y ausencia de errores en consola. Se comprueba geométricamente en el navegador que ninguna capa del marco dibuja un trazo bajo el reloj entre 320 y 1536 px, y que el medallón no conserva bordes de pseudoelementos anteriores. La comprobación visual usa un fondo y datos controlados; no modifica la base de datos ni realiza pagos.
