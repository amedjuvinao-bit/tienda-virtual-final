'use strict';

/* eslint-disable no-console */

const { performance } = require('perf_hooks');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../config/env');
const SiteSettings = require('../models/SiteSettings');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const BillingInvoiceRecoveryTask = require('../models/BillingInvoiceRecoveryTask');
const {
  FACTUS_API_URLS,
  BillingConfigurationError,
  buildRuntimeFactusConfig,
} = require('../lib/billing/billingConfigurationSecurity');
const { getFactusAccessToken } = require('../lib/dian/providers/factusProvider');
const {
  FACTUS_RANGE_DOCUMENTS,
  extractRangeList,
  normalizeFactusRange,
  publicRange,
} = require('../services/billingNumberingRangeService');
const {
  assertVerifiedCompanyMatchesFiscal,
  normalizeCompanySnapshot,
} = require('../services/billingConnectionOrchestrationService');

const HTTP_TIMEOUT_MS = 20_000;
const SLOW_REQUEST_MS = 10_000;
const results = { ok: 0, warnings: [], failures: [] };

function cleanText(value, max = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK       ${message}`);
}

function warning(title, detail = '') {
  results.warnings.push({ title, detail });
  console.warn(`ADVERT.  ${title}`);
  if (detail) console.warn(`         ${detail}`);
}

function fail(title, error) {
  const detail = error?.message || String(error);
  results.failures.push({ title, detail, code: error?.code || '' });
  console.error(`FAIL     ${title}`);
  console.error(`         ${detail}`);
  if (error?.code) console.error(`         Código: ${error.code}`);
}

function assert(condition, message, code = 'FACTUS_LIVE_READINESS_ASSERTION_FAILED') {
  if (!condition) throw Object.assign(new Error(message), { code });
}

async function timed(label, action) {
  const startedAt = performance.now();
  const value = await action();
  const elapsedMs = Math.round(performance.now() - startedAt);

  if (elapsedMs >= SLOW_REQUEST_MS) {
    warning(
      `${label} respondió lentamente (${elapsedMs} ms)`,
      'La conexión funciona, pero esta latencia puede producir esperas visibles o timeouts bajo carga.'
    );
  }

  return { value, elapsedMs };
}

async function fetchJsonReadOnly(url, token, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);

  try {
    const { value: response, elapsedMs } = await timed(label, () =>
      fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `${token.tokenType || 'Bearer'} ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const providerMessage =
        cleanText(data?.message || data?.error, 500) || `HTTP ${response.status}`;
      throw Object.assign(
        new Error(`${label} fue rechazada por Factus: ${providerMessage}`),
        {
          code: 'FACTUS_LIVE_READ_ONLY_REQUEST_FAILED',
          status: response.status,
        }
      );
    }

    return { data, status: response.status, elapsedMs };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(
        new Error(`${label} superó el límite de ${HTTP_TIMEOUT_MS} ms.`),
        { code: 'FACTUS_LIVE_READ_ONLY_TIMEOUT', status: 504 }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function firstObject(value) {
  if (Array.isArray(value)) {
    return value.find((item) => item && typeof item === 'object') || null;
  }
  return value && typeof value === 'object' ? value : null;
}

function extractCompany(payload = {}) {
  const candidates = [
    payload?.data?.data,
    payload?.data,
    payload?.company,
    payload,
  ];
  return candidates.map(firstObject).find(Boolean) || {};
}

function selectedRangeId(billing = {}, type) {
  const provider = billing?.electronicProvider || {};
  const resolution = billing?.dianResolution || {};

  return (
    Number(
      type === 'invoice'
        ? provider.numberingRangeId || resolution.numberingRangeId || 0
        : provider.creditNoteNumberingRangeId ||
            resolution.creditNoteNumberingRangeId ||
            0
    ) || 0
  );
}

function rangeSummary(range = {}) {
  return {
    id: range.id,
    document: range.document,
    prefix: range.prefix,
    current: range.current,
    from: range.from,
    to: range.to,
    active: range.active,
    expired: range.expired,
    exhausted: range.exhausted,
    eligible: range.eligible,
  };
}

async function readRanges(runtime, token, documentCode, label) {
  const url =
    `${runtime.apiUrl}/v2/numbering-ranges` +
    `?filter[document]=${encodeURIComponent(documentCode)}&filter[is_active]=1`;
  const result = await fetchJsonReadOnly(url, token, label);
  const ranges = extractRangeList(result.data)
    .map((range) => normalizeFactusRange(range, documentCode))
    .filter((range) => range.id > 0 && range.document === documentCode);

  return { ...result, ranges };
}

async function fiscalSnapshot() {
  const [invoiceAggregate, recoveryAggregate] = await Promise.all([
    ElectronicInvoice.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          creditNotes: { $sum: { $size: { $ifNull: ['$creditNotes', []] } } },
          latestUpdatedAt: { $max: '$updatedAt' },
        },
      },
    ]),
    BillingInvoiceRecoveryTask.aggregate([
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          latestUpdatedAt: { $max: '$updatedAt' },
        },
      },
    ]),
  ]);

  const invoice = invoiceAggregate[0] || {};
  const recovery = recoveryAggregate[0] || {};

  return {
    invoices: Number(invoice.count || 0),
    creditNotes: Number(invoice.creditNotes || 0),
    invoicesLatestUpdatedAt: invoice.latestUpdatedAt
      ? new Date(invoice.latestUpdatedAt).toISOString()
      : null,
    recoveryTasks: Number(recovery.count || 0),
    recoveryLatestUpdatedAt: recovery.latestUpdatedAt
      ? new Date(recovery.latestUpdatedAt).toISOString()
      : null,
  };
}

function assertOfficialEnvironment(runtime) {
  const expected = FACTUS_API_URLS[runtime.environment];

  assert(
    Boolean(expected),
    `El ambiente ${runtime.environment} no tiene una URL oficial definida.`,
    'FACTUS_LIVE_ENVIRONMENT_INVALID'
  );
  assert(
    runtime.apiUrl === expected,
    `La URL configurada (${runtime.apiUrl}) no coincide con la oficial (${expected}).`,
    'FACTUS_LIVE_API_URL_MISMATCH'
  );
}

function verifyCompanyIdentity(runtime, companyRaw, fiscalInfo = {}) {
  const company = normalizeCompanySnapshot(companyRaw, fiscalInfo);

  try {
    const verified = assertVerifiedCompanyMatchesFiscal(company, fiscalInfo);
    ok(
      `Identidad fiscal coincidente: NIT ${verified.nit}${verified.dv ? `-${verified.dv}` : ''}`
    );
    return verified;
  } catch (error) {
    if (runtime.environment === 'production') throw error;

    warning(
      'La empresa de habilitación usa una identidad de prueba distinta al NIT fiscal real',
      `Factus sandbox respondió con NIT ${company.nit || 'sin identificar'}${
        company.dv ? `-${company.dv}` : ''
      }. La tienda conserva su NIT fiscal real. Esta diferencia es permitida únicamente en habilitación; Producción seguirá bloqueada hasta que ambos coincidan.`
    );
    return company;
  }
}

async function main() {
  console.log('\nREADINESS REAL DE FACTUS — SOLO LECTURA');
  console.log('Contacta Factus y MongoDB reales.');
  console.log('No crea, valida, reenvía, elimina ni modifica facturas o notas crédito.\n');

  try {
    assertEnv();
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15_000 });
    ok(`MongoDB conectado mediante ${env.mongoUriSource}`);
  } catch (error) {
    fail('Conexión y configuración local', error);
    return;
  }

  let beforeSnapshot = null;

  try {
    const settings = await SiteSettings.findOne().lean();
    assert(
      settings,
      'No existe SiteSettings para probar Factus.',
      'BILLING_SETTINGS_NOT_FOUND'
    );

    const billing = settings.billing || {};
    const runtime = buildRuntimeFactusConfig(billing);
    assertOfficialEnvironment(runtime);
    ok(`Ambiente y URL oficial confirmados: ${runtime.environment}`);

    beforeSnapshot = await fiscalSnapshot();

    const firstAuth = await timed('OAuth real', () => getFactusAccessToken(runtime));
    assert(
      firstAuth.value?.success === true && firstAuth.value?.accessToken,
      cleanText(firstAuth.value?.error, 500) ||
        'Factus no devolvió un token OAuth válido.',
      'FACTUS_LIVE_AUTH_FAILED'
    );
    assert(
      firstAuth.value.fromCache !== true,
      'La primera autenticación del proceso no llegó directamente a Factus.',
      'FACTUS_LIVE_AUTH_UNEXPECTED_CACHE'
    );
    ok(`OAuth real aprobado en ${firstAuth.elapsedMs} ms`);

    const secondAuth = await timed('Reutilización OAuth', () =>
      getFactusAccessToken(runtime)
    );
    assert(
      secondAuth.value?.success === true && secondAuth.value?.accessToken,
      'La segunda obtención del token falló.',
      'FACTUS_LIVE_AUTH_CACHE_FAILED'
    );

    if (secondAuth.value.fromCache === true) {
      ok(`Caché OAuth reutilizado correctamente en ${secondAuth.elapsedMs} ms`);
    } else {
      warning(
        'El token OAuth no fue reutilizado en la segunda llamada',
        'Esto no bloquea la conexión, pero aumenta autenticaciones y riesgo de rate limit bajo carga.'
      );
    }

    const token = secondAuth.value;
    const companyResult = await fetchJsonReadOnly(
      `${runtime.apiUrl}/v2/companies`,
      token,
      'Consulta real de empresa'
    );
    const company = verifyCompanyIdentity(
      runtime,
      extractCompany(companyResult.data),
      billing.fiscalInfo || {}
    );
    ok(
      `Empresa Factus consultada: NIT ${company.nit || 'sin identificar'}${
        company.dv ? `-${company.dv}` : ''
      }${company.name ? ` | ${company.name}` : ''} | ${companyResult.elapsedMs} ms`
    );

    const [invoiceResult, creditNoteResult] = await Promise.all([
      readRanges(
        runtime,
        token,
        FACTUS_RANGE_DOCUMENTS.invoice,
        'Consulta real de rangos de factura'
      ),
      readRanges(
        runtime,
        token,
        FACTUS_RANGE_DOCUMENTS.creditNote,
        'Consulta real de rangos de nota crédito'
      ),
    ]);

    const invoiceEligible = invoiceResult.ranges.filter((range) => range.eligible);
    const creditEligible = creditNoteResult.ranges.filter((range) => range.eligible);

    ok(
      `Rangos de factura consultados: ${invoiceResult.ranges.length} encontrados, ${invoiceEligible.length} elegibles | ${invoiceResult.elapsedMs} ms`
    );

    if (creditNoteResult.ranges.length > 0) {
      ok(
        `Rangos de nota crédito consultados: ${creditNoteResult.ranges.length} encontrados, ${creditEligible.length} elegibles | ${creditNoteResult.elapsedMs} ms`
      );
    } else {
      warning(
        'Factus no devolvió rangos de nota crédito para este ambiente',
        runtime.environment === 'production'
          ? 'Producción no está lista para emitir notas crédito.'
          : 'La conexión funciona, pero el sandbox no permite probar todavía el flujo completo de notas crédito.'
      );
    }

    const invoiceSelectedId = selectedRangeId(billing, 'invoice');
    const creditSelectedId = selectedRangeId(billing, 'creditNote');
    const selectedInvoice = invoiceResult.ranges.find(
      (range) => range.id === invoiceSelectedId
    );
    const selectedCredit = creditNoteResult.ranges.find(
      (range) => range.id === creditSelectedId
    );

    if (invoiceSelectedId > 0 && selectedInvoice?.eligible) {
      ok(`Rango de factura seleccionado ${invoiceSelectedId} existe y está elegible`);
    } else {
      warning(
        'El rango de factura seleccionado no está confirmado como elegible',
        invoiceSelectedId > 0
          ? `ID configurado: ${invoiceSelectedId}.`
          : 'No hay un ID de rango de factura seleccionado.'
      );
    }

    if (creditSelectedId > 0 && selectedCredit?.eligible) {
      ok(`Rango de nota crédito seleccionado ${creditSelectedId} existe y está elegible`);
    } else {
      warning(
        'El rango de nota crédito seleccionado no está confirmado como elegible',
        creditSelectedId > 0
          ? `ID configurado: ${creditSelectedId}.`
          : 'No hay un ID de rango de nota crédito seleccionado.'
      );
    }

    console.log('\nRANGOS ELEGIBLES DE FACTURA');
    console.log(
      JSON.stringify(
        invoiceEligible.map((range) => rangeSummary(publicRange(range))),
        null,
        2
      )
    );
    console.log('\nRANGOS ELEGIBLES DE NOTA CRÉDITO');
    console.log(
      JSON.stringify(
        creditEligible.map((range) => rangeSummary(publicRange(range))),
        null,
        2
      )
    );

    const invalidUrlBilling = {
      ...billing,
      electronicProvider: {
        ...(billing.electronicProvider || {}),
        apiUrl: 'https://example.invalid',
      },
    };
    let invalidUrlBlocked = false;

    try {
      buildRuntimeFactusConfig(invalidUrlBilling);
    } catch (error) {
      invalidUrlBlocked = error instanceof BillingConfigurationError;
    }

    assert(
      invalidUrlBlocked,
      'Una URL no oficial no fue bloqueada antes de contactar la red.',
      'FACTUS_LIVE_UNOFFICIAL_URL_NOT_BLOCKED'
    );
    ok('URL no oficial bloqueada localmente antes de realizar solicitudes');

    const afterSnapshot = await fiscalSnapshot();
    assert(
      JSON.stringify(beforeSnapshot) === JSON.stringify(afterSnapshot),
      'El estado de facturas, notas crédito o tareas de recuperación cambió durante la prueba. Detén otros procesos y repite para confirmar que no hubo actividad concurrente.',
      'FACTUS_LIVE_FISCAL_SNAPSHOT_CHANGED'
    );
    ok('MongoDB confirmó que no se creó ni modificó ningún documento fiscal');
  } catch (error) {
    fail('Readiness real de Factus', error);
  } finally {
    await mongoose.disconnect().catch(() => null);
  }

  console.log('\nRESUMEN READINESS REAL');
  console.log(`OK: ${results.ok}`);
  console.log(`ADVERTENCIAS: ${results.warnings.length}`);
  console.log(`FALLOS: ${results.failures.length}`);

  if (results.warnings.length) {
    console.log('\nDEBILIDADES O BLOQUEOS DETECTADOS');
    results.warnings.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      if (item.detail) console.log(`   ${item.detail}`);
    });
  }

  if (results.failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
