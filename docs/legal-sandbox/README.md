# Documentación legal para desarrollo

Sitio estático para describir el entorno de pruebas y la integración autorizada de TikTok. No ejecuta la tienda, no cobra y no conecta con la base de datos local. Está separado de los términos comerciales que ya aparecen en el checkout.

## Contenido y datos utilizados

- `site.json`: identidad, contacto, fecha y URL del sitio. El nombre ROSA BOUTIQUE corresponde a la app de TikTok mostrada por el titular. El WhatsApp se conserva del contacto ya publicado en `frontend/src/components/ModalPrivacidad.jsx` y `ModalTerminos.jsx`. No se han inventado NIT, razón social, domicilio ni correo.
- `content.json`: textos en español, específicos del entorno de desarrollo y de los datos que trata la integración actual. No establece nuevas condiciones de venta, plazos de devolución o garantías comerciales.
- `styles.css`: presentación adaptable, sin fuentes externas, analítica o JavaScript.
- `scripts/buildLegalSandbox.cjs`: generador sin dependencias, con escape de texto y validación de enlaces HTTPS.

Se puede cambiar la identidad y el contenido en estos archivos y volver a generar. En este alcance la edición se realiza en el repositorio; no se ha añadido un editor legal al panel ni se han sustituido los modales del checkout. La edición desde el panel y la adaptación legal comercial quedan para la publicación definitiva.

## Generar y revisar

Desde la raíz:

```sh
node scripts/buildLegalSandbox.cjs
```

Esto genera exclusivamente `frontend/public/legal/index.html`, `terminos.html`, `privacidad.html`, `styles.css` y `.nojekyll`. No borra el resto de recursos. Vite sirve la documentación en `/legal/index.html` y la copia al compilar la tienda.

Para generar un directorio de publicación separado:

```sh
node scripts/buildLegalSandbox.cjs --out /tmp/tiktok-legal-pages
```

Los HTML generados contienen todo el texto y funcionan sin JavaScript. Usan enlaces relativos, por lo que se pueden alojar en GitHub Pages o trasladar a otra ruta.

## Publicación en GitHub Pages

La rama dedicada `gh-pages` debe contener únicamente esos cinco archivos en la raíz. La rama de trabajo mantiene las fuentes y la copia local de las páginas. `main` y el backend no se despliegan.

GitHub debe tener activado **Settings → Pages → Build and deployment → Deploy from a branch → gh-pages → /(root) → Save**. Crear la rama no activa Pages por sí solo. La conexión de GitHub de este entorno permite commits y ramas, pero no configurar Pages; el acceso inicial a esa opción requiere una sesión de administrador del repositorio. No se solicitan tokens personales nuevos ni se guardan credenciales de GitHub en el proyecto.

Cuando GitHub confirme la publicación, las direcciones esperadas son:

- Sitio: `https://amedjuvinao-bit.github.io/tienda-virtual-final/`
- Términos: `https://amedjuvinao-bit.github.io/tienda-virtual-final/terminos.html`
- Privacidad: `https://amedjuvinao-bit.github.io/tienda-virtual-final/privacidad.html`

Estas direcciones solo deben darse por activas después de comprobar una respuesta HTTP 200 y el contenido servido. No contienen credenciales, no usan túneles ni tienen una caducidad automática configurada.

Después, en TikTok Sandbox: plataforma Web, dirección del sitio y enlaces legales; añadir Login Kit y Display API, permisos `user.info.basic` y `video.list`, aplicar cambios y registrar la cuenta en Target users. Las credenciales del panel deben corresponder a ese Sandbox. La conexión real y los permisos de la app siguen pendientes de la autorización del titular en TikTok.

## Dominio definitivo

Al publicar la tienda, revisar la identidad legal del negocio, el contacto y los textos con sus condiciones reales; integrar su edición en el panel, ajustar las URLs de TikTok y completar la revisión de producción. Para generar documentos con un nuevo origen, cambiar `site.json.siteUrl` o pasar `--site-url` con la URL HTTPS real. No es necesario rehacer el diseño de TikTok ni su lógica de selección de publicaciones.

Las páginas de desarrollo no constituyen una certificación de cumplimiento ni sustituyen la identificación y revisión legal necesarias antes de operar comercialmente.

Referencias: [TikTok Developer Guidelines](https://developers.tiktok.com/docs/en/our-guidelines-developer-guidelines), [Sandbox](https://developers.tiktok.com/docs/en/add-a-sandbox), [GitHub Pages: fuente de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Datos técnicos de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
