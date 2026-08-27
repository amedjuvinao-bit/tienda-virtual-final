/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readBillingConfigurationFrontendSource,
} = require('./lib/readBillingConfigurationFrontendSource');

process.env.BILLING_ENCRYPTION_KEY =
  process.env.BILLING_ENCRYPTION_KEY ||
  'billing-numbering-range-test-key-32-characters-minimum';

const {
  FACTUS_RANGE_DOCUMENTS,
  extractFactusErrorMessage,
  extractRangeList,
  isoDate,
  mergeCandidateBilling,
  normalizeCreditNoteRangeInput,
  normalizeFactusRange,
  publicRange,
} = require('../services/billingNumberingRangeService');

const ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, fail: 0 };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function testDocumentCodesAndPayloadExtraction() {
  assert(FACTUS_RANGE_DOCUMENTS.invoice === '21', 'Factura debe usar documento 21.');
  assert(FACTUS_RANGE_DOCUMENTS.creditNote === '22', 'Nota crédito debe usar documento 22.');

  const list = extractRangeList({
    data: {
      data: [{ id: 10 }, { id: 20 }],
    },
  });
  assert(list.length === 2, 'No reconoce la lista paginada de Factus.');
  assert(isoDate('2099-12-31') === '2099-12-31', 'No conserva fecha ISO.');
  assert(isoDate('31-12-2099') === '2099-12-31', 'No normaliza fecha DD-MM-AAAA.');

  ok('Códigos documentales, paginación y fechas de Factus se interpretan correctamente');
}

function testFactusCreationErrorIsUsefulAndSafe() {
  const message = extractFactusErrorMessage({
    message: 'The given data was invalid.',
    errors: {
      prefix: ['El prefijo NC ya está registrado.'],
      current: ['El consecutivo debe ser menor o igual a 9999.'],
    },
    data: {
      message: 'Authorization: secreto-no-debe-salir',
    },
  });

  assert(
    message.includes('El prefijo NC ya está registrado.'),
    'Ocultó el motivo específico enviado por Factus.'
  );
  assert(
    message.includes('El consecutivo debe ser menor o igual a 9999.'),
    'Perdió una validación adicional enviada por Factus.'
  );
  assert(
    !message.includes('secreto-no-debe-salir'),
    'Expuso un dato sensible incluido en el error del proveedor.'
  );

  ok('Rechazos de creación muestran el motivo de Factus sin exponer datos sensibles');
}

function testEligibleRanges() {
  const invoice = normalizeFactusRange(
    {
      id: 101,
      document: '21',
      document_name: 'Factura de venta',
      prefix: 'SETP',
      from: 1,
      to: 5000,
      current: 25,
      resolution_number: '18760000001',
      start_date: '01-01-2026',
      end_date: '31-12-2099',
      technical_key: 'secreto-fiscal',
      is_active: 1,
      is_expired: 0,
    },
    '21'
  );
  const credit = normalizeFactusRange(
    {
      id: 202,
      document_name: 'Nota crédito',
      prefix: 'NC',
      from: 1,
      to: 1000,
      current: 4,
      start_date: '2026-01-01',
      end_date: '2099-12-31',
      is_active: true,
    },
    '22'
  );
  const sandboxCreditWithoutResolution = normalizeFactusRange(
    {
      id: 390,
      document: '22',
      document_name: 'Nota Crédito',
      prefix: 'NC',
      from: 0,
      to: 0,
      current: 455,
      resolution_number: '',
      start_date: '',
      end_date: '',
      is_active: 1,
      is_expired: 0,
    },
    '22'
  );

  assert(invoice.eligible === true, 'Rechazó un rango vigente de factura.');
  assert(credit.eligible === true, 'Rechazó un rango vigente de nota crédito.');
  assert(
    sandboxCreditWithoutResolution.eligible === true,
    'Rechazó un rango activo de nota crédito sin resolución DIAN.'
  );
  assert(
    sandboxCreditWithoutResolution.exhausted === false,
    'Interpretó el rango abierto 0–0 de nota crédito como agotado.'
  );
  assert(invoice.document === '21', 'Alteró el tipo de factura.');
  assert(credit.document === '22', 'Alteró el tipo de nota crédito.');
  assert(invoice.startDate === '2026-01-01', 'No normalizó la fecha inicial.');

  ok('Rangos de factura y rangos abiertos de nota crédito se interpretan según Factus');
}

function testCreditNoteRangeCreationInput() {
  const normalized = normalizeCreditNoteRangeInput({
    prefix: ' nc1 ',
    current: '1',
    document: '21',
  });

  assert(normalized.document === '22', 'El navegador puede alterar el documento 22.');
  assert(normalized.prefix === 'NC1', 'No normaliza el prefijo alfanumérico.');
  assert(normalized.current === 1, 'No normaliza el consecutivo positivo.');

  [
    { prefix: '', current: 1 },
    { prefix: 'ABCDE', current: 1 },
    { prefix: 'N-C', current: 1 },
    { prefix: 'NC', current: 0 },
    { prefix: 'NC', current: '1.5' },
  ].forEach((input) => {
    let rejected = false;
    try {
      normalizeCreditNoteRangeInput(input);
    } catch {
      rejected = true;
    }
    assert(rejected, `Aceptó datos inseguros: ${JSON.stringify(input)}`);
  });

  ok('Creación fija documento 22 y valida prefijo y consecutivo en el backend');
}

function testUnsafeRangesAreRejected() {
  const base = {
    id: 10,
    document: '21',
    from: 1,
    to: 100,
    current: 10,
    start_date: '2026-01-01',
    end_date: '2099-12-31',
    is_active: 1,
  };
  const inactive = normalizeFactusRange({ ...base, is_active: 0 }, '21');
  const expired = normalizeFactusRange({ ...base, is_expired: 1 }, '21');
  const exhausted = normalizeFactusRange({ ...base, current: 101 }, '21');
  const wrongDocument = normalizeFactusRange({ ...base, document: '22' }, '21');
  const inactiveOpenCredit = normalizeFactusRange(
    {
      id: 390,
      document: '22',
      prefix: 'NC',
      from: 0,
      to: 0,
      current: 455,
      is_active: 0,
      is_expired: 0,
    },
    '22'
  );
  const creditWithoutSequence = normalizeFactusRange(
    {
      id: 390,
      document: '22',
      prefix: 'NC',
      from: 0,
      to: 0,
      current: 0,
      is_active: 1,
      is_expired: 0,
    },
    '22'
  );

  assert(inactive.eligible === false, 'Aceptó un rango inactivo.');
  assert(expired.eligible === false, 'Aceptó un rango vencido.');
  assert(exhausted.eligible === false, 'Aceptó un rango agotado.');
  assert(wrongDocument.eligible === false, 'Mezcló rangos de documentos distintos.');
  assert(
    inactiveOpenCredit.eligible === false,
    'Aceptó un rango abierto de nota crédito inactivo.'
  );
  assert(
    creditWithoutSequence.eligible === false,
    'Aceptó un rango de nota crédito sin siguiente consecutivo.'
  );

  ok('Rangos inactivos, vencidos, agotados o de otro documento quedan bloqueados');
}

function testCandidateUsesStoredSecretsAndTrustedMetadata() {
  const stored = {
    dian: { mode: 'habilitacion' },
    electronicProvider: {
      provider: 'factus',
      apiUrl: 'https://api-sandbox.factus.com.co',
      clientId: 'stored-client',
      clientSecret: 'stored-secret',
      username: 'stored-user',
      password: 'stored-password',
      lastConnectionStatus: 'success',
      lastConnectionFingerprint: 'trusted-fingerprint',
      numberingRangesFingerprint: 'trusted-ranges',
    },
  };
  const candidate = mergeCandidateBilling(stored, {
    billing: {
      dian: { mode: 'production' },
      electronicProvider: {
        apiUrl: 'https://api.factus.com.co',
        clientId: 'production-client',
        clientSecret: '',
        username: 'production-user',
        password: '',
        lastConnectionStatus: 'browser-forged',
        lastConnectionFingerprint: 'browser-forged',
      },
    },
  });

  assert(candidate.dian.mode === 'production', 'No usa el ambiente candidato.');
  assert(candidate.electronicProvider.clientId === 'production-client', 'No usa Client ID candidato.');
  assert(candidate.electronicProvider.clientSecret === 'stored-secret', 'Perdió secreto protegido almacenado.');
  assert(candidate.electronicProvider.password === 'stored-password', 'Perdió contraseña protegida almacenada.');
  assert(candidate.electronicProvider.lastConnectionStatus === 'success', 'Confió en metadata del navegador.');
  assert(candidate.electronicProvider.lastConnectionFingerprint === 'trusted-fingerprint', 'Aceptó huella manipulada.');

  ok('Candidato conserva secretos protegidos y no puede falsificar la verificación');
}

function testTechnicalKeyNeverLeavesBackend() {
  const safe = publicRange({
    id: 10,
    document: '21',
    technicalKey: 'no-debe-salir',
  });

  assert(!Object.prototype.hasOwnProperty.call(safe, 'technicalKey'), 'Expuso la clave técnica.');

  const route = read('backend/routes/dianProviderTest.js');
  assert(route.includes('safeResolution'), 'La ruta no filtra la resolución.');
  assert(route.includes('technicalKey'), 'La ruta no elimina la clave técnica.');

  ok('Clave técnica se cifra en MongoDB y nunca se devuelve al navegador');
}

function testOfficialLookupAndSelectionControls() {
  const service = read('backend/services/billingNumberingRangeService.js');
  const persistence = read(
    'backend/services/billingNumberingRangePersistenceService.js'
  );
  const route = read('backend/routes/dianProviderTest.js');
  const settingsRoute = read('backend/routes/billingSettingsProtection.js');

  assert(
    service.includes('/v2/numbering-ranges') &&
      service.includes('filter[document]') &&
      service.includes('filter[is_active]'),
    'No consulta rangos oficiales filtrados en Factus.'
  );
  assert(
    service.includes('FACTUS_CONNECTION_REQUIRED_FOR_NUMBERING_RANGES'),
    'Permite consultar rangos sin conexión verificada.'
  );
  assert(
    service.includes('numberingRangesFingerprint') &&
      service.includes('numberingRangesEnvironment'),
    'No vincula rangos con credenciales y ambiente.'
  );
  assert(
    service.includes('requireEligibleRange') &&
      service.includes('FACTUS_NUMBERING_RANGE_SELECTION_INVALID'),
    'No vuelve a validar la selección contra Factus antes de guardar.'
  );
  assert(
    route.includes("router.get('/numbering-ranges'") &&
      route.includes("'/numbering-ranges/query'") &&
      route.includes("'/numbering-ranges/credit-note'") &&
      route.includes("router.put('/numbering-ranges'") &&
      route.includes("requirePermission('billing:settings')"),
    'Las rutas de rangos no están completas o protegidas.'
  );
  assert(
    route.includes('numberingRangeLimiter') &&
      route.includes('numberingRangeCreationLimiter') &&
      route.includes('max: 20') &&
      route.includes('max: 5'),
    'Faltan límites específicos para consultar o crear rangos.'
  );
  assert(
    service.includes("method: 'POST'") &&
      service.includes('document: FACTUS_RANGE_DOCUMENTS.creditNote') &&
      service.includes('FACTUS_CREDIT_NOTE_RANGE_ALREADY_AVAILABLE') &&
      service.includes('FACTUS_CREDIT_NOTE_RANGE_CREATE_IN_PROGRESS') &&
      service.includes('creditNoteRangeCreationLocks') &&
      service.includes(
        'FACTUS_CREDIT_NOTE_RANGE_PRODUCTION_CONFIRMATION_REQUIRED'
      ),
    'La creación del rango no está protegida contra documento alterado, duplicados, concurrencia o Producción sin confirmar.'
  );
  assert(
    persistence.includes('assertProductionNumberingRangesReady') &&
      persistence.includes('BILLING_PRODUCTION_NUMBERING_RANGES_NOT_READY') &&
      settingsRoute.includes('assertProductionNumberingRangesReady'),
    'Producción no exige rangos vinculados a la conexión actual.'
  );

  ok('Consulta y Producción exigen permiso, conexión, ambiente y huellas verificadas');
}

function testHiddenFingerprintsAreSelectedExplicitly() {
  const services = [
    [
      'consulta de rangos',
      read('backend/services/billingNumberingRangeService.js'),
    ],
    [
      'persistencia de rangos',
      read('backend/services/billingNumberingRangePersistenceService.js'),
    ],
    [
      'guardado de configuración',
      read('backend/services/billingConfigurationService.js'),
    ],
    [
      'orquestación de conexión',
      read('backend/services/billingConnectionOrchestrationService.js'),
    ],
  ];

  services.forEach(([label, source]) => {
    assert(
      source.includes('FACTUS_FINGERPRINT_SELECT') &&
        /\.select\(\s*FACTUS_FINGERPRINT_SELECT\s*\)/.test(source),
      `La ${label} no solicita las huellas ocultas de MongoDB.`
    );
  });

  ok('Servicios internos solicitan las huellas ocultas sin exponerlas al navegador');
}

function testFrontendHasNoManualFiscalRangeFields() {
  const block = read(
    'frontend/src/admin/configuracion/sections/facturacion/FactusNumberingRangesBlock.jsx'
  );
  const resolution = read(
    'frontend/src/admin/configuracion/sections/facturacion/DianResolutionBlock.jsx'
  );
  const section = readBillingConfigurationFrontendSource();

  assert(block.includes('Consultar rangos oficiales'), 'Falta consulta desde el panel.');
  assert(block.includes('Guardar rangos seleccionados'), 'Falta guardar la selección.');
  assert(block.includes('eligibleInvoiceRanges'), 'No filtra rangos de facturas.');
  assert(block.includes('eligibleCreditNoteRanges'), 'No filtra rangos de notas crédito.');
  assert(block.includes('/numbering-ranges/query'), 'No consulta con el candidato verificado actual.');
  assert(
    block.includes('/numbering-ranges/credit-note') &&
      block.includes('Crear rango de nota crédito') &&
      block.includes('Confirmar creación en Factus') &&
      block.includes('applyRangeResponse(data, createdId)'),
    'El panel no crea, confirma y vuelve a cargar el rango de nota crédito.'
  );
  assert(block.includes('{ billing }'), 'No envía el candidato actual al backend.');
  assert(
    resolution.includes('FactusNumberingRangesBlock') &&
      resolution.includes('billing={billing}'),
    'El paso Resolución no usa el candidato completo.'
  );
  assert(
    section.includes('billing={billing}'),
    'El asistente no entrega el candidato al selector de rangos.'
  );
  [
    'Número de resolución DIAN',
    'Rango inicial',
    'Rango final',
    'Número actual',
    'Clave técnica DIAN',
  ].forEach((manualLabel) => {
    assert(!resolution.includes(manualLabel), `Sigue editable manualmente: ${manualLabel}.`);
  });

  ok('Panel reemplaza digitación manual por selección oficial del candidato verificado');
}

function testFrontendShowsUnavailableRangeDiagnostics() {
  const block = read(
    'frontend/src/admin/configuracion/sections/facturacion/FactusNumberingRangesBlock.jsx'
  );

  assert(
    block.includes('Rangos de nota crédito devueltos por Factus') &&
      block.includes('Código documental:') &&
      block.includes('Activo en Factus:') &&
      block.includes('Motivo de no disponibilidad:') &&
      block.includes('unavailableRangeReasons(range).join'),
    'El panel no muestra los datos y el motivo de descarte de cada rango devuelto por Factus.'
  );

  ok('Panel muestra cada rango no disponible y explica por qué fue descartado');
}

function testSavedRangesRefreshThePersistedSnapshot() {
  const block = read(
    'frontend/src/admin/configuracion/sections/facturacion/FactusNumberingRangesBlock.jsx'
  );
  const resolution = read(
    'frontend/src/admin/configuracion/sections/facturacion/DianResolutionBlock.jsx'
  );
  const section = readBillingConfigurationFrontendSource();
  const route = read('backend/routes/dianProviderTest.js');

  assert(
    route.includes('settings,') &&
      block.includes("typeof onSaved === 'function' && data.settings") &&
      block.includes('await onSaved(data.settings)'),
    'El guardado de rangos no entrega al formulario la configuración confirmada por el backend.'
  );
  assert(
    resolution.includes('onSaved={onSaved}') &&
      section.includes('handleNumberingRangesSaved') &&
      section.includes('onSaved={handleNumberingRangesSaved}') &&
      section.includes('applySettings(settings)'),
    'El asistente no actualiza su copia guardada después de persistir los rangos.'
  );

  ok('Guardar rangos actualiza la copia persistida y elimina la alerta falsa de cambios');
}

function testCreditNoteRangeCreationIsAudited() {
  const permissionMap = read('backend/security/adminRoutePermissionMap.js');
  const routeIndex = permissionMap.indexOf(
    "path: '/api/dian-provider/numbering-ranges/credit-note'"
  );

  assert(routeIndex >= 0, 'La creación del rango no está en el mapa de permisos.');
  const routeBlock = permissionMap.slice(routeIndex, routeIndex + 420);
  assert(
    routeBlock.includes("permission: 'billing:settings'") &&
      routeBlock.includes('audit: true') &&
      routeBlock.includes('danger: true'),
    'La creación del rango no exige permiso sensible ni registra auditoría.'
  );

  ok('Creación exige permiso, confirmación y queda registrada en auditoría');
}

function testEmissionUsesStoredSelections() {
  const rangeProvider = read(
    'backend/lib/dian/providers/factusRangeAwareProvider.js'
  );
  const adapter = read('backend/lib/dian/providerAdapter.js');
  const bootstrap = read('backend/services/electronicCreditNoteRangeService.js');
  const index = read('backend/index.js');
  const creditNoteRangePosition = index.indexOf(
    'electronicCreditNoteRangeService'
  );
  const paymentRoutesPosition = index.indexOf("'./routes/payments'");

  assert(
    rangeProvider.includes('numbering_range_id: numberingRangeId'),
    'La factura no envía el rango seleccionado.'
  );
  assert(
    rangeProvider.includes('providerConfig.creditNoteNumberingRangeId'),
    'La nota crédito no usa su rango separado.'
  );
  assert(
    rangeProvider.includes('FACTUS_INVOICE_NUMBERING_RANGE_REQUIRED') &&
      rangeProvider.includes('FACTUS_CREDIT_NOTE_NUMBERING_RANGE_REQUIRED'),
    'La emisión no se bloquea cuando faltan rangos.'
  );
  assert(
    !rangeProvider.includes('/v2/numbering-ranges?'),
    'La emisión vuelve a seleccionar rangos dinámicamente.'
  );
  assert(
    adapter.includes("require('./providers/factusRangeAwareProvider')"),
    'La factura sigue usando el proveedor anterior.'
  );
  assert(
    bootstrap.includes('factusProvider.sendCreditNoteToFactus = sendCreditNoteToFactus'),
    'La nota crédito no se enruta al proveedor con rango sincronizado.'
  );
  assert(
    creditNoteRangePosition >= 0 &&
      paymentRoutesPosition >= 0 &&
      creditNoteRangePosition < paymentRoutesPosition,
    'El proveedor de notas se inicializa después de las rutas heredadas.'
  );

  ok('Facturas y notas crédito usan únicamente los IDs sincronizados en MongoDB');
}

function testRegistration() {
  const packageFile = read('backend/package.json');
  const closure = read('backend/scripts/testBillingModuleClosure.js');

  assert(
    packageFile.includes('test:billing-numbering-ranges'),
    'package.json no registra test:billing-numbering-ranges.'
  );
  assert(
    closure.includes('testBillingNumberingRangesModule.js'),
    'El cierre integral no ejecuta la prueba de rangos.'
  );

  ok('Prueba de rangos registrada en el cierre integral');
}

function main() {
  console.log('\nValidando rangos oficiales de numeración Factus...');

  [
    testDocumentCodesAndPayloadExtraction,
    testFactusCreationErrorIsUsefulAndSafe,
    testEligibleRanges,
    testCreditNoteRangeCreationInput,
    testUnsafeRangesAreRejected,
    testCandidateUsesStoredSecretsAndTrustedMetadata,
    testTechnicalKeyNeverLeavesBackend,
    testOfficialLookupAndSelectionControls,
    testHiddenFingerprintsAreSelectedExplicitly,
    testFrontendHasNoManualFiscalRangeFields,
    testFrontendShowsUnavailableRangeDiagnostics,
    testSavedRangesRefreshThePersistedSnapshot,
    testCreditNoteRangeCreationIsAudited,
    testEmissionUsesStoredSelections,
    testRegistration,
  ].forEach((test) => {
    try {
      test();
    } catch (error) {
      results.fail += 1;
      console.error(`FAIL ${test.name}`);
      console.error(`     ${error.message}`);
    }
  });

  console.log(
    `\nResumen rangos Factus -> OK: ${results.ok} FAIL: ${results.fail}`
  );
  if (results.fail > 0) process.exit(1);
}

main();
