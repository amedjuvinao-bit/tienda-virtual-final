'use strict';

// Express 5 passes listen errors to the callback. Never report a successful
// startup (or start workers) when another process owns the requested port.
function listenHttpServer(app, port, host) {
  return new Promise((resolve, reject) => {
    const ready = error => error ? reject(error) : resolve(server);
    const server = host ? app.listen(port, host, ready) : app.listen(port, ready);
  });
}

function startupErrorMessage(error, port) {
  if (error?.code === 'EADDRINUSE') return `No se inició este backend: el puerto ${port} está ocupado por otro proceso. La tienda sigue consultando ese proceso, no esta versión.`;
  return `No se pudo iniciar el backend (${error?.code || 'STARTUP_ERROR'}): ${error?.message || 'Error desconocido'}`;
}

module.exports = { listenHttpServer, startupErrorMessage };
