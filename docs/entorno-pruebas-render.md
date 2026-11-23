# Entorno de pruebas de Rosa Boutique

Propuesta preparada el 23 de noviembre de 2026. Los recursos de pruebas todavía
no están creados. El archivo de producción `render.yaml` conserva su configuración.

## Configuración propuesta

Un entorno fijo dentro del workspace Hobby actual, con el mismo backend Docker
y frontend estático que producción. No se duplica una tienda por cada Pull Request.
Las vistas previas completas por PR requieren Pro y añaden cargos de cómputo.

| Componente | Configuración de pruebas |
| --- | --- |
| Código | Rama `staging`; despliegues manuales de una revisión ya validada |
| API | `rosa-boutique-staging-api`, Virginia, 0,5 CPU / 512 MB, una instancia |
| Archivos | Disco propio de 1 GB en `/var/data`, sin compartir el disco comercial |
| Tienda | `rosa-boutique-staging-web`, frontend estático con HTTPS |
| Sesión Safari | API a través de `/api/*` en el mismo origen de la tienda |
| MongoDB | Base vacía `rosa_boutique_staging` con usuario restringido a esa base |
| Cloudinary | Credenciales de un entorno de producto separado; carpeta propia |
| Claves | Nuevas e independientes, generadas por Render salvo la clave del respaldo |
| Cobros y facturación | Desactivados inicialmente; después se configuran cuentas sandbox |
| Envíos | Manuales inicialmente; sin guías reales |
| Correo | Sin credenciales inicialmente; después un buzón o receptor de pruebas |

`NODE_ENV=production` mantiene las mismas validaciones de seguridad del servidor.
Eso no activa pagos ni facturación reales. Wompi se configura desde el panel en
modo sandbox; Factus requiere credenciales y destino de pruebas verificados.
La configuración actual rechaza Envia sandbox con `NODE_ENV=production`; por eso
esta propuesta mantiene el proveedor manual. Probar Envia sandbox requeriría
un cambio separado y revisado.

No importar clientes, pedidos, suscriptores, configuraciones cifradas ni usuarios
de producción. Crear datos sintéticos y una cuenta de pruebas con su propio 2FA.
El encabezado `X-Robots-Tag` pide no indexar el sitio; no lo convierte en privado.

## Presupuesto mensual de Render

Conversión de referencia: **1 USD = 3.461,92 COP**, TRM vigente del 21 al 23 de
noviembre de 2026. Los valores COP se redondean al peso.

| Concepto | USD/mes | COP/mes aproximados |
| --- | ---: | ---: |
| Servidor de pruebas 0,5 CPU / 512 MB | 7,00 | 24.233 |
| Disco de pruebas 1 GB | 0,25 | 865 |
| Frontend de pruebas, tarifa base | 0,00 | 0 |
| Workspace Hobby, tarifa base | 0,00 | 0 |
| **Adicional base por staging** | **7,25** | **25.099** |
| Producción actual: servidor + disco de 5 GB | 8,25 | 28.561 |
| **Total base producción + staging** | **15,50** | **53.660** |

Son tarifas base para recursos activos un mes completo, no un límite máximo de
facturación. Render cobra en USD; la conversión y posibles cargos del banco,
impuestos, excedentes de tráfico y minutos de compilación pueden variar.
Producción y staging comparten las cuotas incluidas del workspace.
El límite de gasto de compilaciones de $0 no limita servidor, disco ni tráfico.

MongoDB Atlas, Cloudinary y el receptor de correo se revisan por separado antes
de contratar o activar nada: no se presupuestan como gratuitos sin comprobar
las cuotas y disponibilidad de las cuentas. No hace falta comprar otro dominio
para probar; se usarían las direcciones HTTPS asignadas por Render.

El servidor gratuito no ofrece disco persistente, se suspende por inactividad
y bloquea SMTP 465/587. El servidor pagado reproduce mejor la operación existente,
incluidas las pruebas de correo y persistencia de archivos.

## Activación después de aprobar el costo

La plantilla candidata es `deploy/render.staging.example.yaml`. No debe vincularse
al Blueprint de producción ni sustituir `render.yaml`.

1. Revisar y guardar la preparación en Git mediante PR. Crear la rama `staging`
   desde una revisión validada; el Blueprint de pruebas usará esa rama y su propio
   archivo, con sincronización automática desactivada al principio.
2. Preparar la base vacía y el usuario MongoDB de pruebas. Autorizar únicamente
   el acceso de red necesario y verificar el nombre de la base antes de escribir.
   Si se comparte clúster con otra base, también se comparte capacidad; usar
   credenciales restringidas y nunca una cuenta con acceso a producción.
3. Preparar Cloudinary separado y guardar los valores `sync: false` directamente
   en Render. No copiar claves de producción. `BACKUP_ENCRYPTION_KEY` requiere
   64 caracteres hexadecimales generados de forma privada.
4. La variable existente `STAGING_MONGODB_URI` significa **destino de restauración
   del respaldo**, no entorno operativo de pruebas. Debe apuntar a otro servidor
   desechable que no contenga ninguna aplicación. No reutilizar el destino de
   restauración de producción ni apuntarla a la nueva base operativa.
5. Revisar el plan de un Blueprint independiente: exactamente una API con disco
   de 1 GB y un frontend estático; ninguna sustitución de recursos comerciales.
   Su aprobación inicia el consumo de estos recursos, aunque fallen al arrancar.
6. La primera creación reserva las URLs reales. Las dos reescrituras de la
   plantilla apuntan deliberadamente a `.invalid`: nunca al backend comercial.
   Obtener la URL asignada a la nueva API, sustituir ambos destinos en el archivo
   propio de staging y sincronizar el Blueprint de pruebas. Render no interpola
   variables en esos destinos y el nombre no reserva un subdominio exacto.
7. Verificar `/healthz`, el origen de la tienda y la base seleccionada. En la Shell
   **del nuevo servidor de staging**, desde `/app/backend`, crear roles y sede con
   `node scripts/seedAdminBase.js`. Después configurar temporalmente un usuario
   `ADMIN_OWNER_USERNAME` y contraseña `ADMIN_OWNER_PASSWORD` privados de pruebas
   y ejecutar `node scripts/seedAdminOwner.js`; retirar esas variables temporales.
   No ejecutar estos comandos en la Shell comercial.
8. Revisar y aplicar los índices con los scripts existentes antes de probar
   pedidos: `NODE_ENV=production` desactiva `autoIndex`. Preparar productos
   sintéticos; configurar únicamente integraciones sandbox y destinatarios de
   correo controlados. No hay un bloqueo global que impida al administrador
   introducir credenciales reales: esa separación depende de las credenciales
   y configuraciones que se aprueben para este entorno.
9. Validar login, recarga y cierre en Safari; comprobar que las respuestas de
   `/api/admin/auth/verify` son JSON y no HTML. Probar compra sandbox, permisos,
   archivos tras reinicio y respaldo/restauración usando solo los datos sintéticos.

Hasta resolver las URLs y comprobar las integraciones, staging no está listo
para validar una publicación. El YAML puede ser estructuralmente válido y aún
requerir esos valores de aprovisionamiento.

## Forma de trabajar después

Los cambios se hacen localmente en una rama `feature/...` o `fix/...`, se suben
a GitHub y se abre un PR hacia `main`. Esperar sus comprobaciones, desplegar
deliberadamente ese mismo commit en staging y revisar el resultado. Si hace
falta corregirlo, repetir con la nueva revisión, no publicar la anterior.

Cuando el resultado esté aprobado y el PR cumpla `proteccion-main`, integrarlo
en `main`; los servicios comerciales siguen esperando sus comprobaciones antes
de desplegarse. Verificar la versión publicada. Una reversión de código se hace
con otro PR; las migraciones de datos requieren su propio respaldo y reversión.

Fuentes consultadas el 23 de noviembre de 2026:

- Precios: https://render.com/pricing
- Vistas previas completas: https://render.com/docs/preview-environments
- Restricciones gratuitas: https://render.com/docs/free
- Discos: https://render.com/docs/disks
- Sintaxis y referencias: https://render.com/docs/blueprint-spec
- TRM oficial: https://www.superfinanciera.gov.co/CargaDriver/
