# Revisión de enlaces públicos

La página Novedades tiene destino propio en `/lo-nuevo` y ubicación de edición en Páginas. Los seis catálogos registrados cuentan con ruta pública, editor y opción de destino en Apariencia.

## Resultados

La comprobación estática examinó 320 archivos fuente disponibles y 67 referencias internas de navegación, con coincidencia de rutas mediante el enrutador utilizado por la aplicación. Se excluyeron imágenes, API, rutas administrativas y valores de color. Hay 64 referencias con ruta y tres referencias antiguas sin ruta.

Las rutas informativas del footer clásico y editorial tienen destino: historia, sede, contacto, envíos, cambios y devoluciones, preguntas frecuentes, privacidad y condiciones. Sus alias conservan el destino existente. Las opciones de atención al consumidor cuentan con sus rutas declaradas.

El destino genérico `/categorias`, utilizado por tarjetas nuevas o enlaces inválidos, se resolvía a una página inexistente. Ahora las tarjetas nuevas utilizan `/#categorias`; el enlace genérico anterior y las entradas no válidas también regresan a esa sección de Inicio. Los enlaces válidos configurados y las imágenes de las tarjetas se conservan.

## Enlaces antiguos de la plantilla

| Texto predeterminado | Destino sin ruta | Origen |
| --- | --- | --- |
| 0–12 meses | `/categoria/bebe` | `categoriasSectionHelpers.js`, tarjeta `cat_3` |
| 2–8 años | `/categoria/2-8` | `categoriasSectionHelpers.js`, tarjeta `cat_4` |
| 9–12 años | `/categoria/9-12` | `categoriasSectionHelpers.js`, tarjeta `cat_5` |

Estas referencias proceden de valores predeterminados anteriores. No demuestran que la instalación del usuario siga utilizándolas: sus tarjetas pueden tener otro nombre, fotografía y enlace guardados. Los destinos de edad requieren su selección correspondiente; no son equivalentes a Bautizos, Vestidos, Jeans o Calzado.

Para una tarjeta que ahora represente otra categoría, abrir **Apariencia → Categorías → Contenido → Nombre y enlace**, elegir la tarjeta, seleccionar su **Página del catálogo** y guardar. La comprobación posterior debe hacerse pulsando esa tarjeta en la página pública. Si el negocio necesita conservar los catálogos por edades, habrá que definir sus páginas y selección de productos por separado.

## Alcance y cierre

La revisión comprueba fuentes y valores predeterminados. No accede a la configuración guardada en la instalación local del usuario, a su inventario ni a cuentas de redes sociales. Los enlaces a productos, pedidos y páginas creadas por el administrador dependen de los registros reales. Los anclajes dependen de que su sección esté visible.

El cierre de todos los enlaces queda pendiente de comprobar los destinos guardados de esas tarjetas en la instalación del usuario. Las páginas de las categorías ya creadas y Novedades están disponibles para asignarlas desde el panel.
