/* eslint-disable no-console */

'use strict';

const {
  clearFactusTokenCache,
} = require('../lib/dian/providers/factusProvider');
const {
  cleanupSinglePendingInvoiceInSandbox,
} = require('../lib/dian/providers/factusRangeAwareProvider');

const originalFetch = global.fetch;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return data;
    },
  };
}

function providerConfig(apiUrl = 'https://api-sandbox.factus.com.co') {
  return {
    apiUrl,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    username: 'sandbox@example.com',
    password: 'password',
    numberingRangeId: 101,
  };
}

function installFetch({ pending = [], deleteStatus = 200 } = {}) {
  const calls = [];

  global.fetch = async (url, options = {}) => {
    const target = String(url);
    const method = String(options.method || 'GET').toUpperCase();
    calls.push({ target, method });

    if (target.includes('/oauth/token')) {
      return response(200, {
        access_token: 'sandbox-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    if (
      target.includes('/v2/bills?') &&
      target.includes('filter[status]=0')
    ) {
      return response(200, {
        data: {
          data: pending,
        },
      });
    }

    if (
      method === 'DELETE' &&
      target.includes('/v2/bills/destroy/reference/')
    ) {
      return response(
        deleteStatus,
        deleteStatus === 200
          ? { status: 'OK', message: 'Documento eliminado' }
          : { message: 'No fue posible eliminar' }
      );
    }

    throw new Error(`Solicitud inesperada: ${method} ${target}`);
  };

  return calls;
}

async function runCase(name, work) {
  clearFactusTokenCache();
  try {
    await work();
    passed += 1;
    console.log(`OK  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(`     ${error.message}`);
  } finally {
    clearFactusTokenCache();
  }
}

async function main() {
  console.log(
    '\nValidando limpieza segura de facturas pendientes en Factus habilitación...'
  );

  await runCase('Exige confirmación explícita', async () => {
    const calls = installFetch();
    const result = await cleanupSinglePendingInvoiceInSandbox({
      providerConfig: providerConfig(),
    });

    assert(
      result.code === 'FACTUS_PENDING_CLEANUP_CONFIRMATION_REQUIRED',
      'Permitió la limpieza sin confirmación.'
    );
    assert(calls.length === 0, 'Contactó Factus sin confirmación.');
  });

  await runCase('Bloquea producción antes de consultar documentos', async () => {
    const calls = installFetch();
    const result = await cleanupSinglePendingInvoiceInSandbox({
      providerConfig: providerConfig('https://api.factus.com.co'),
      confirm: true,
    });

    assert(
      result.code === 'FACTUS_PENDING_CLEANUP_PRODUCTION_BLOCKED',
      'No bloqueó la URL de producción.'
    );
    assert(calls.length === 0, 'Contactó producción antes de bloquearla.');
  });

  await runCase('No elimina cuando no hay pendientes', async () => {
    const calls = installFetch({ pending: [] });
    const result = await cleanupSinglePendingInvoiceInSandbox({
      providerConfig: providerConfig(),
      confirm: true,
    });

    assert(result.success && result.cleaned === false, 'Reportó una limpieza inexistente.');
    assert(
      calls.every((call) => call.method !== 'DELETE'),
      'Ejecutó DELETE sin una factura pendiente.'
    );
  });

  await runCase('Elimina una única factura no validada del sandbox', async () => {
    const calls = installFetch({
      pending: [
        {
          id: 233,
          number: 'SETP990002233',
          reference_code: '000233',
          status: 0,
          is_validated: false,
          validated_at: null,
        },
      ],
    });
    const result = await cleanupSinglePendingInvoiceInSandbox({
      providerConfig: providerConfig(),
      confirm: true,
    });
    const deletes = calls.filter((call) => call.method === 'DELETE');

    assert(result.success && result.cleaned, 'No limpió la pendiente confirmada.');
    assert(result.referenceCode === '000233', 'Cambió la referencia del documento.');
    assert(deletes.length === 1, 'No ejecutó exactamente un DELETE.');
    assert(
      deletes[0].target.endsWith('/000233'),
      'Eliminó una referencia diferente a la pendiente.'
    );
  });

  await runCase('No elimina si Factus devuelve varias pendientes', async () => {
    const calls = installFetch({
      pending: [
        {
          reference_code: '000231',
          status: 0,
          is_validated: false,
        },
        {
          reference_code: '000232',
          status: 0,
          is_validated: false,
        },
      ],
    });
    const result = await cleanupSinglePendingInvoiceInSandbox({
      providerConfig: providerConfig(),
      confirm: true,
    });

    assert(
      result.code === 'FACTUS_PENDING_CLEANUP_AMBIGUOUS',
      'No bloqueó el resultado ambiguo.'
    );
    assert(
      calls.every((call) => call.method !== 'DELETE'),
      'Eliminó un documento aunque había varias pendientes.'
    );
  });

  console.log(
    `\nResumen pendiente Factus -> OK: ${passed} FAIL: ${failed}`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    clearFactusTokenCache();
  });
