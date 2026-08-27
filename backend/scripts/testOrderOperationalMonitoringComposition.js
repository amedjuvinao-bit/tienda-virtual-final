'use strict';

/* eslint-disable no-console */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FACADE_PATH = path.join(
  ROOT,
  'services',
  'orderOperationalMonitoringService.js'
);
const MODULE_ROOT = path.join(
  ROOT,
  'services',
  'orderOperationalMonitoring'
);
const EXPECTED_MODULES = Object.freeze([
  'constants.js',
  'metricsPipeline.js',
  'mongoExpressions.js',
  'operationalChecks.js',
  'service.js',
]);
const EXPECTED_EXPORTS = Object.freeze([
  'DAY_MS',
  'DEFAULT_THRESHOLDS',
  'PREPARATION_STALE_MS',
  'SLA_RISK_MS',
  'TRANSIT_STALE_MS',
  'buildOperationalChecks',
  'buildOrderHealthMetricsPipeline',
  'buildOrderHealthPipeline',
  'createOrderOperationalMonitoringService',
  'getOperationalHealth',
]);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineCount(source) {
  return source.split(/\r?\n/).length;
}

function localDependencies(source) {
  return [...source.matchAll(/require\(['"]\.\/([^'"]+)['"]\)/g)].map(
    (match) => `${match[1].replace(/\.js$/, '')}.js`
  );
}

function assertAcyclic(graph) {
  const visiting = new Set();
  const visited = new Set();

  function visit(moduleName, trail = []) {
    assert.ok(
      !visiting.has(moduleName),
      `Dependencia circular: ${[...trail, moduleName].join(' -> ')}`
    );
    if (visited.has(moduleName)) return;

    visiting.add(moduleName);
    for (const dependency of graph.get(moduleName) || []) {
      if (graph.has(dependency)) visit(dependency, [...trail, moduleName]);
    }
    visiting.delete(moduleName);
    visited.add(moduleName);
  }

  for (const moduleName of graph.keys()) visit(moduleName);
}

function main() {
  const facade = read(FACADE_PATH);
  const moduleNames = fs
    .readdirSync(MODULE_ROOT)
    .filter((name) => name.endsWith('.js'))
    .sort();

  assert.deepStrictEqual(moduleNames, [...EXPECTED_MODULES]);
  assert.ok(
    lineCount(facade) <= 100,
    `La fachada tiene ${lineCount(facade)} líneas; máximo permitido: 100.`
  );
  assert.ok(!facade.includes('.aggregate('));
  assert.ok(!facade.includes('$facet'));

  const graph = new Map();
  for (const moduleName of moduleNames) {
    const source = read(path.join(MODULE_ROOT, moduleName));
    assert.ok(
      lineCount(source) <= 450,
      `${moduleName} tiene ${lineCount(source)} líneas; máximo permitido: 450.`
    );
    graph.set(moduleName, localDependencies(source));
  }
  assertAcyclic(graph);

  const publicApi = require('../services/orderOperationalMonitoringService');
  assert.deepStrictEqual(Object.keys(publicApi).sort(), [...EXPECTED_EXPORTS].sort());

  const pipelineSource = read(path.join(MODULE_ROOT, 'metricsPipeline.js'));
  const serviceSource = read(path.join(MODULE_ROOT, 'service.js'));
  assert.ok(pipelineSource.includes('$facet'));
  assert.ok(pipelineSource.includes('buildOperationalSummaryPipeline(now)'));
  assert.ok(serviceSource.includes('allowDiskUse(true)'));

  console.log('OK  fachada de observabilidad <= 100 líneas');
  console.log('OK  módulos cohesivos <= 450 líneas');
  console.log('OK  grafo interno sin ciclos');
  console.log('OK  API pública y responsabilidades preservadas');
  console.log('\nComposición de observabilidad de Órdenes: 4/4 controles superados.');
}

try {
  main();
} catch (error) {
  console.error('\nFALLO composición de observabilidad de Órdenes:', error);
  process.exitCode = 1;
}
