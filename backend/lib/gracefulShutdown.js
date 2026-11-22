'use strict';

function createGracefulShutdown({
  server, stopWorkers, workersIdle, disconnect, logger = console,
  // Render services with a disk have a fixed 30-second shutdown window.
  // Leave five seconds for process termination before the platform sends SIGKILL.
  timeoutMs = 25000,
}) {
  let stopping = false;
  let completion;
  let finished = false;

  async function drain() {
    stopWorkers();
    const requests = new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    const workers = (async () => {
      while (!finished && !workersIdle()) await new Promise(resolve => setTimeout(resolve, 100));
    })();
    await Promise.all([requests, workers]);
    if (!finished) await disconnect();
  }

  function shutdown() {
    if (completion) return completion;
    stopping = true;
    logger.info('[shutdown] Esperando solicitudes y tareas en curso.');
    completion = (async () => {
      let deadline;
      try {
        await Promise.race([
          drain(),
          new Promise((_, reject) => {
            deadline = setTimeout(() => reject(new Error('SHUTDOWN_TIMEOUT')), timeoutMs);
          }),
        ]);
        logger.info('[shutdown] Servidor y conexión cerrados.');
        return 0;
      } catch {
        logger.error('[shutdown] No se completó el cierre dentro del plazo.');
        server.closeAllConnections?.();
        return 1;
      } finally {
        finished = true;
        clearTimeout(deadline);
      }
    })();
    return completion;
  }

  return { shutdown, isStopping: () => stopping };
}

module.exports = { createGracefulShutdown };
