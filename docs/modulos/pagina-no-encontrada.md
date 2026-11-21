# Página no encontrada

La ruta comodín de React muestra `NotFound` cuando una dirección pública no corresponde a una página de la tienda. Obtiene su configuración de `GET /api/pages/not-found`; la página fija se administra desde `/admin/notfound-page/:id` y conserva el contrato `notFoundPageConfig` con sus propiedades anteriores.

## Presentación y recuperación

`NotFoundPageView` comparte el material `CartGlass`, el borde pulido y el fondo continuo de Carrito y Favoritos. El título, mensaje, ilustración, código, enlaces, medidas, colores y elementos visibles utilizan un único normalizador: `buildSafeNotFoundPageConfig`. El pie utiliza `StorefrontFooter`: conserva su marco de cristal y hereda el fondo de esta página, sin superponer la imagen propia del footer. El fondo puede continuar Inicio o usar imágenes propias de escritorio y móvil; el fondo móvil utiliza la misma capa fija que el carrito.

Los ajustes `useHeader`, `useFooter`, `showHeader`, `showFooter`, ilustración, título con imagen y visibilidad se respetan tanto en la página pública como en la vista previa. La ausencia o fallo de una imagen nunca deja una columna vacía. Un título con imagen fallida recupera su texto y una ilustración fallida recupera el código si está habilitado.

Los enlaces se limitan a rutas internas. La página incluye una acción principal y otra secundaria configurables. Siempre conserva un encabezado accesible, aunque el título se oculte visualmente.

Desactivar el diseño personalizado recupera la presentación predeterminada con una salida al inicio; no elimina la ruta de recuperación. Si falla la consulta de configuración, se ofrece una página funcional con reintento. Durante la consulta se utiliza el indicador configurado y el fondo de la tienda, sin mostrar un encabezado temporal. Las solicitudes se abortan al salir de la página.

## Editor y contrato

El editor utiliza `SystemPageEditor`, `PageEditorWorkspace`, `usePageDraft` y `AdminImageUploadField`. Los controles están agrupados en título e ilustración, navegación, fondo y cristal, colores, medidas y visibilidad. Las imágenes se seleccionan desde el equipo y se cargan mediante el servicio de medios existente; no se solicita escribir una URL de imagen.

La vista previa de escritorio y móvil ejecuta el mismo `NotFoundPageView` dentro del iframe aislado del editor. Los enlaces se bloquean en esa vista. El contenedor de la vista previa permanece visible al recorrer el formulario.

El guardado se bloquea durante cargas y verifica que la respuesta conserve todos los ajustes normalizados. Una respuesta incompleta o fallida conserva el borrador. Las extensiones desconocidas de la configuración se preservan y se mantiene la protección de navegación con cambios pendientes.

`SystemPageEditor` permite reutilizar el ciclo de carga, validación del tipo de página, guardado verificado y protección del borrador en otras páginas fijas, mediante un normalizador y un componente de controles específicos.

## Verificación

```sh
cd frontend
node node_modules/vitest/vitest.mjs run src/components/not-found src/pages/NotFound.test.jsx src/admin/pages/NotFoundPageEditor.test.jsx
node node_modules/vite/bin/vite.js build
```

La tarea `test:pages-module` incluye también las pruebas de esta página. Las comprobaciones del navegador usan el enrutador público, el editor y la vista previa reales con API simulada. No modifican MongoDB ni realizan cargas reales a Cloudinary.
