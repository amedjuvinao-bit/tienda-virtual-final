# Revisión de enlaces públicos

Las cinco tarjetas predeterminadas de Categorías abren sus catálogos propios. Novedades tiene destino independiente en `/lo-nuevo`. Las seis páginas registradas cuentan con ruta pública, editor y opción de destino en Apariencia.

## Destinos de Categorías

| Tarjeta | Ruta pública |
| --- | --- |
| Complementos | `/complementos` |
| Bautizos | `/categoria/bautizos` |
| Vestidos | `/categoria/vestidos` |
| Jeans | `/categoria/jeans` |
| Calzado | `/categoria/calzado` |

Los valores predeterminados obtienen los nombres y destinos de `shared/catalogPages.json`, el mismo registro utilizado por las rutas, el servidor y los selectores del panel. Se conservan los identificadores, imágenes, encuadres y ajustes de presentación. Las fotografías incluidas como respaldo mantienen su posición anterior.

La normalización corrige los tres destinos antiguos `/categoria/bebe`, `/categoria/2-8` y `/categoria/9-12` cuando el nombre visible coincide con un catálogo registrado. También corrige la antigua tarjeta `cat_2` si ya representa Bautizos y todavía apunta a `/lo-nuevo`. La corrección se aplica al leer la configuración, tanto en el panel como en la página pública, sin modificar registros en la base de datos ni el objeto de entrada.

Los enlaces personalizados válidos, incluidos destinos externos, se conservan. Si la tarjeta continúa llamándose por una edad u otro nombre desconocido, no se le asigna un catálogo diferente. En ese caso, el administrador debe elegir su destino en **Apariencia → Categorías → Contenido → Nombre y enlace → Página del catálogo**. No se infiere una categoría a partir de la fotografía.

## Revisión estática

La comprobación examinó 320 archivos fuente, sin errores de análisis, y 62 referencias internas literales de navegación; todas coinciden con rutas declaradas mediante el enrutador de la aplicación. Se excluyeron imágenes, API, rutas administrativas y valores de color. Las cinco referencias predeterminadas de Categorías ahora se calculan desde el registro compartido y se comprueban mediante pruebas de componente, por separado del recuento de literales.

Las rutas informativas del footer clásico y editorial tienen destino: historia, sede, contacto, envíos, cambios y devoluciones, preguntas frecuentes, privacidad y condiciones. Sus alias conservan el destino existente. Las opciones de atención al consumidor cuentan con sus rutas declaradas.

El destino genérico anterior `/categorias` y las entradas no válidas regresan a `/#categorias`. Las tarjetas nuevas utilizan también ese anclaje hasta que el administrador elige una página específica.

## Validación

- 171 pruebas de interfaz en 17 archivos: catálogos, consultas, tarjetas, editor, administración, carga de imágenes, destinos y sección de categorías.
- Las pruebas cubren las cinco rutas predeterminadas, las cuatro combinaciones heredadas conocidas, los datos de imagen y encuadre, la conservación de enlaces propios y el caso de una categoría por edad sin equivalencia.
- Compilación de producción de Vite correcta y diferencias sin errores de formato.

La prueba Chromium `frontend/e2e/categoryNavigation.e2e.js` completó 19 controles con respuestas controladas:

- Inicio sin desbordamiento horizontal a 1536, 1024, 768, 390 y 320 px.
- Clic real en las cinco tarjetas a 1536 y 390 px, título y producto del catálogo correspondiente, y regreso con Atrás a la posición anterior.
- Apertura y cierre con Escape de los filtros móviles.
- Acceso a Novedades desde el menú de escritorio y el menú móvil, consulta sin categoría impuesta y orden por fecha.
- Enlaces esperados del footer en escritorio y apertura de cada grupo de navegación móvil.
- Ningún error de ejecución capturado ni solicitudes de escritura a la API.

El montaje utiliza los componentes reales de encabezado, categorías, páginas de catálogo, footer, restauración de desplazamiento y parallax, con el mismo modo de renderizado estándar de `index.html`. Sustituye las respuestas de API y los contextos de carrito y favoritos. No verifica operaciones reales de compra ni cargas externas. Se ejecuta desde `frontend` con `node e2e/categoryNavigation.e2e.js`; admite `PLAYWRIGHT_EXECUTABLE_PATH` para un Chromium ya instalado y guarda resultados y capturas en `/tmp/category-navigation-e2e` o en `CATEGORY_NAVIGATION_ARTIFACTS`.

## Alcance

La revisión comprueba el código, los valores predeterminados y respuestas controladas. No accede a la configuración guardada en la instalación local del usuario, a su inventario ni a cuentas de redes sociales. Los enlaces a productos, pedidos y páginas creadas por el administrador dependen de los registros reales. Los anclajes dependen de que su sección esté visible.

El código y la plantilla quedan sin destinos internos sin ruta dentro de las referencias examinadas. Esto no certifica los enlaces personalizados guardados en otra instalación, sus procesos de pago, su operación comercial ni el cumplimiento legal completo.
