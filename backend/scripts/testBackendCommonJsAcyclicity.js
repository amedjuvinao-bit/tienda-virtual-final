'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const GRAPH_ROOTS = ['controllers', 'routes', 'services', 'models'];
const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

const FISCAL_CONTRACTS = {
  './services/electronicInvoiceIssuanceService': {
    BILLABLE_ORDER_STATUSES: 'object',
    PAID_PAYMENT_STATUSES: 'object',
    assertTotalsReconciled: 'function',
    buildCustomerSnapshot: 'function',
    calculateTotals: 'function',
    createElectronicInvoiceIssuanceService: 'function',
    extractProviderDocument: 'function',
    issueElectronicInvoiceForOrder: 'function',
    isBillableOrder: 'function',
    isNoChargeExchangeOrder: 'function',
    sanitizeProviderPayload: 'function',
  },
  './services/electronicInvoiceEmailService': {
    buildInvoiceEmailContent: 'function',
    findInvoice: 'function',
    isValidatedInvoice: 'function',
    sendValidatedInvoiceEmail: 'function',
    serializeEmailDelivery: 'function',
  },
  './services/electronicInvoiceDocumentService': {
    downloadOfficialInvoiceDocument: 'function',
    normalizeType: 'function',
    providerName: 'function',
  },
  './services/adminBillingSyncService': {
    assertRemoteIdentity: 'function',
    extractRemoteDocument: 'function',
    normalizeRemoteStatus: 'function',
    resolveFactusInvoiceNumber: 'function',
    syncCreditNote: 'function',
    syncInvoice: 'function',
  },
  './services/adminBillingService': {
    buildBillableOrderFilter: 'function',
    extractProviderDocument: 'function',
    generateInvoiceForOrder: 'function',
    getBillingSettingsSnapshot: 'function',
    getBillingSummary: 'function',
    getInvoicePreflight: 'function',
    getMailConfigurationSnapshot: 'function',
    listCreditNotes: 'function',
    listElectronicInvoices: 'function',
    listPendingBillableOrders: 'function',
    serializeCreditNote: 'function',
    serializeElectronicInvoice: 'function',
    serializeEmailDelivery: 'function',
  },
  './services/billingInvoicePreflightService': {
    FINAL_CONSUMER_DOCUMENT: 'string',
    assertPreflightReady: 'function',
    buildInvoicePreflight: 'function',
    validateCustomerSnapshot: 'function',
  },
  './services/adminBillingSerializationService': {
    serializeCreditNote: 'function',
    serializeElectronicInvoice: 'function',
    serializeEmailDelivery: 'function',
  },
};

function walkJavaScript(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkJavaScript(absolutePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
}

function resolveLocalDependency(fromFile, request, knownFiles) {
  if (!request.startsWith('.')) return null;
  const target = path.resolve(path.dirname(fromFile), request);
  const candidates = [target, `${target}.js`, path.join(target, 'index.js')];
  return candidates.find((candidate) => knownFiles.has(candidate)) || null;
}

function buildCommonJsGraph() {
  const files = GRAPH_ROOTS.flatMap((directory) =>
    walkJavaScript(path.join(BACKEND_ROOT, directory))
  );
  const knownFiles = new Set(files);
  const graph = new Map(files.map((file) => [file, new Set()]));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const sourceWithoutLiteralRequires = source.replace(REQUIRE_PATTERN, '');
    assert.doesNotMatch(
      sourceWithoutLiteralRequires,
      /\brequire\s*\(/,
      `${path.relative(BACKEND_ROOT, file)} contiene un require dinámico que el grafo no puede resolver`
    );
    for (const match of source.matchAll(REQUIRE_PATTERN)) {
      const dependency = resolveLocalDependency(file, match[1], knownFiles);
      if (dependency) graph.get(file).add(dependency);
    }
  }
  return graph;
}

function findStronglyConnectedComponents(graph) {
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of graph.get(node) || []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), lowLinks.get(dependency))
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), indexes.get(dependency))
        );
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }

  for (const node of graph.keys()) {
    if (!indexes.has(node)) visit(node);
  }
  return components;
}

function createSeededOrder(values, seed) {
  const output = [...values];
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function assertAcyclicBackendGraph() {
  const graph = buildCommonJsGraph();
  const cyclic = findStronglyConnectedComponents(graph).filter(
    (component) =>
      component.length > 1 ||
      (component.length === 1 && graph.get(component[0])?.has(component[0]))
  );
  const readable = cyclic.map((component) =>
    component.map((file) => path.relative(BACKEND_ROOT, file)).join(' -> ')
  );
  assert.deepEqual(
    readable,
    [],
    `Se detectaron ciclos CommonJS:\n${readable.join('\n')}`
  );
  console.log(`OK  grafo CommonJS acíclico: ${graph.size} módulos revisados`);
}

function assertRandomFiscalLoadOrder() {
  const modules = Object.keys(FISCAL_CONTRACTS);
  const orders = [
    modules,
    [...modules].reverse(),
    createSeededOrder(modules, 7),
    createSeededOrder(modules, 23),
    createSeededOrder(modules, 101),
  ];
  const childSource = `
    const assert = require('node:assert/strict');
    const mongoose = require('mongoose');
    const order = JSON.parse(process.argv[1]);
    const contracts = JSON.parse(process.argv[2]);
    for (const modulePath of order) {
      const loaded = require(modulePath);
      const expected = contracts[modulePath];
      assert.deepEqual(Object.keys(loaded).sort(), Object.keys(expected).sort());
      for (const [exportName, exportType] of Object.entries(expected)) {
        assert.equal(
          typeof loaded[exportName],
          exportType,
          modulePath + ' no expuso ' + exportName
        );
      }
    }
    assert.equal(mongoose.connection.readyState, 0);
  `;

  orders.forEach((order, index) => {
    const result = spawnSync(
      process.execPath,
      ['-e', childSource, JSON.stringify(order), JSON.stringify(FISCAL_CONTRACTS)],
      {
        cwd: BACKEND_ROOT,
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test' },
      }
    );
    assert.equal(
      result.status,
      0,
      `La permutación fiscal ${index + 1} no cargó:\n${result.stderr || result.stdout}`
    );
  });
  console.log(`OK  contratos fiscales completos en ${orders.length} órdenes de carga aislados`);
}

function assertSerializationFacadeParity() {
  const publicService = require('../services/adminBillingService');
  const serializers = require('../services/adminBillingSerializationService');
  const invoice = {
    _id: 'invoice-1',
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    invoiceNumber: 'FV-1',
    status: 'accepted',
    customer: { email: 'cliente@example.com' },
    provider: {
      name: 'factus',
      number: 'FV-1',
      cufe: 'cufe-1',
      isValidated: true,
    },
    emailDelivery: { status: 'sent', attempts: 1 },
    creditNotes: [],
  };
  const note = {
    _id: 'note-1',
    status: 'validated',
    totalAmount: 25000,
    provider: { name: 'factus', number: 'NC-1', isValidated: true },
  };

  assert.deepEqual(
    publicService.serializeElectronicInvoice(invoice),
    serializers.serializeElectronicInvoice(invoice)
  );
  assert.deepEqual(
    publicService.serializeCreditNote(invoice, note, 0),
    serializers.serializeCreditNote(invoice, note, 0)
  );
  assert.deepEqual(
    publicService.serializeEmailDelivery(invoice.emailDelivery, invoice.customer),
    serializers.serializeEmailDelivery(invoice.emailDelivery, invoice.customer)
  );
  console.log('OK  fachada pública conserva serialización idéntica al módulo inferior');
}

assertAcyclicBackendGraph();
assertRandomFiscalLoadOrder();
assertSerializationFacadeParity();
console.log('RESULTADO: arquitectura CommonJS fiscal sin ciclos ni exports parciales.');
