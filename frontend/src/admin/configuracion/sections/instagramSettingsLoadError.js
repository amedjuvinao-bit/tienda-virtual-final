const PATH = '/api/admin/instagram-settings';
export function instagramSettingsEndpoint(baseUrl = '') {
  try {
    const url = new URL(PATH, baseUrl || window.location.origin);
    url.username = ''; url.password = ''; url.search = ''; url.hash = '';
    return url.href;
  } catch { return PATH; }
}
export function instagramSettingsLoadError(error) {
  const status = error?.response?.status;
  if (error?.code === 'INSTAGRAM_INVALID_SETTINGS_RESPONSE') return {
    title: 'El servidor no devolvió los ajustes de Instagram.',
    help: 'La respuesta recibida no contiene una configuración válida. Revisa que el frontend apunte al backend de esta tienda.',
    status: status ? `HTTP ${status} · respuesta inesperada` : 'Respuesta inesperada',
  };
  if (status === 404) return {
    title: 'El backend no encuentra la ruta de ajustes de Instagram.',
    help: 'Comprueba que el proceso del backend esté ejecutando la rama feature/apariencia-nivel-plus y que incluya el commit 16af377 o uno posterior.',
    status: 'HTTP 404',
  };
  if (status === 401) return {
    title: 'La sesión no permite cargar estos ajustes.', help: 'Vuelve a iniciar sesión en el panel y abre Instagram.', status: 'HTTP 401',
  };
  if (status === 403) return {
    title: 'El servidor denegó el acceso a los ajustes de Instagram.',
    help: 'Este apartado requiere el permiso settings:instagram o acceso de administrador o propietario.', status: 'HTTP 403',
  };
  if (!status) return {
    title: error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' ? 'El backend tardó demasiado en responder.' : 'El navegador no pudo obtener una respuesta del backend.',
    help: 'Comprueba la dirección del servidor indicada debajo. Puede tratarse de conexión, un bloqueo del navegador o permisos entre frontend y backend.', status: 'Sin respuesta HTTP',
  };
  return {
    title: status >= 500 ? 'El backend falló al cargar los ajustes de Instagram.' : 'No se pudieron cargar los ajustes de Instagram.',
    help: status >= 500 ? 'Revisa el error de esta petición en la terminal del backend. El código HTTP permite identificar el fallo sin modificar tus credenciales.' : 'El servidor rechazó la consulta. Revisa su respuesta antes de volver a intentar.',
    status: `HTTP ${status}`,
  };
}
