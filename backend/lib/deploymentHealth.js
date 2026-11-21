'use strict';

// This probe stays outside authentication, rate limits and planned backup
// maintenance. A paused store must not be restarted in the middle of a backup.
function createDeploymentHealth({ connection, isStopping = () => false }) {
  return async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (isStopping() || connection.readyState !== 1 || !connection.db) {
      return res.status(503).json({ ok: false });
    }
    try {
      await connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
      return res.status(200).json({ ok: true });
    } catch {
      // Never expose database addresses, credentials or driver diagnostics.
      return res.status(503).json({ ok: false });
    }
  };
}

module.exports = { createDeploymentHealth };
