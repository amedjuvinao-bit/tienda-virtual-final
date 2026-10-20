'use strict';

module.exports = function mountInstagramRoutes(app, routes = require('./instagram')) {
  // Fail at startup if an incomplete router is loaded, instead of serving 404s.
  for (const [router, method, path] of [
    [routes.admin, 'get', '/feed'],
    [routes.admin, 'post', '/refresh-feed'],
    [routes.publicRouter, 'get', '/feed'],
    [routes.publicRouter, 'get', '/admin/feed'],
  ]) {
    if (!router?.stack?.some(layer => layer.route?.path === path && layer.route.methods[method])) {
      throw new Error(`Instagram: falta la ruta ${method.toUpperCase()} ${path}. No se puede iniciar con un módulo incompleto.`);
    }
  }
  app.use('/api/admin/instagram-settings', routes.admin);
  app.use('/api/instagram', routes.publicRouter);
};
