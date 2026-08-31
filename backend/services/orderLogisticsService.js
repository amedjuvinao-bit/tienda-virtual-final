'use strict';

// Compatibility facade: consumers keep the historical import path while the
// logistics domain is split into focused modules under ./orderLogistics.
module.exports = require('./orderLogistics');
