/* eslint-disable no-console */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SERVICE_ROOT = path.join(__dirname, '..', 'services');
const FACADE_PATH = path.join(SERVICE_ROOT, 'orderRefundAutomationService.js');
const MODULE_ROOT = path.join(SERVICE_ROOT, 'orderRefundAutomation');
const EXPECTED_EXPORTS = [
  'AUTOMATION_LOCK_MS',
  'automateOrderRefund',
  'buildAutomaticCreditNoteRequest',
  'claimStage',
  'claimedStageId',
  'createAutomationError',
  'createClaimId',
  'isFullRefund',
  'operationKey',
  'safeRefundView',
  'setClaimedStage',
];

let passed = 0;

function ok(label) {
  passed += 1;
  console.log(`OK ${passed}: ${label}`);
}

function lineCount(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function run() {
  const facadeLines = lineCount(FACADE_PATH);
  assert(
    facadeLines <= 100,
    `orderRefundAutomationService.js debe conservarse como fachada <=100 líneas; recibió ${facadeLines}`
  );
  ok(`la fachada pública permanece delgada (${facadeLines} líneas)`);

  const modules = fs.readdirSync(MODULE_ROOT)
    .filter((name) => name.endsWith('.js'))
    .sort();
  assert(modules.length >= 5, 'la automatización debe conservar módulos internos cohesivos');
  for (const moduleName of modules) {
    const count = lineCount(path.join(MODULE_ROOT, moduleName));
    assert(count <= 450, `${moduleName} excede el límite interno de 450 líneas: ${count}`);
  }
  ok(`${modules.length} módulos internos respetan el límite de 450 líneas`);

  const service = require('../services/orderRefundAutomationService');
  assert.deepStrictEqual(Object.keys(service).sort(), EXPECTED_EXPORTS.slice().sort());
  EXPECTED_EXPORTS.forEach((name) => {
    if (name === 'AUTOMATION_LOCK_MS') {
      assert.strictEqual(typeof service[name], 'number');
    } else {
      assert.strictEqual(typeof service[name], 'function', `${name} debe seguir exportado`);
    }
  });
  ok('la fachada conserva exactamente el contrato público previo');

  const facadeSource = fs.readFileSync(FACADE_PATH, 'utf8');
  assert(!facadeSource.includes('findOneAndUpdate'));
  assert(!facadeSource.includes('createOfficialCreditNote'));
  assert(!facadeSource.includes('executeWompiAutomaticRefund'));
  assert(facadeSource.includes("require('./orderRefundAutomation/claims')"));
  assert(facadeSource.includes("require('./orderRefundAutomation/orchestrator')"));
  ok('la fachada delega persistencia, pasarela y orquestación en módulos internos');

  console.log(`\nComposición de automatización de reembolsos: ${passed}/4 controles superados.`);
}

run();
