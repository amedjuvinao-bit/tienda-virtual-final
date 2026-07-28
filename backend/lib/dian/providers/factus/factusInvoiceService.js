'use strict';

const {
  getFactusAccessToken,
  getFactusCredentials,
  validateCredentials,
} = require('./factusAuth');
const {
  buildFactusInvoicePayload,
} = require('./factusPayloads');
const {
  trimSafe,
} = require('./factusProviderShared');

function isFactusPendingBillConflict(data, status) {
  const message = String(data?.message || data?.error || '').toLowerCase();

  return (
    Number(status) === 409 &&
    message.includes('factura pendiente') ||
    message.includes('nota crédito pendiente') ||
    message.includes('nota credito pendiente')
  );
}

function extractFactusBillsList(data) {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.bills)) return data.bills;
  if (Array.isArray(data)) return data;
  return [];
}

function getBillReferenceCode(bill = {}) {
  return (
    bill.reference_code ||
    bill.referenceCode ||
    bill.reference ||
    bill.number ||
    bill.code ||
    bill.id ||
    ''
  );
}

function isPendingFactusBill(bill = {}) {
  const text = JSON.stringify(bill).toLowerCase();

  return (
    text.includes('pendiente') ||
    text.includes('pending') ||
    text.includes('no validada') ||
    text.includes('not validated') ||
    bill.is_validated === false ||
    bill.validated_at === null ||
    bill.status === 0
  );
}

async function listFactusBills({ credentials, tokenResult }) {
  const response = await fetch(`${credentials.apiUrl}/v2/bills?per_page=20`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  return {
    success: response.ok,
    status: response.status,
    data,
    bills: extractFactusBillsList(data),
    error: response.ok
      ? null
      : data?.message || data?.error || data || `HTTP ${response.status}`,
  };
}

async function deleteFactusBillByReference({ credentials, tokenResult, referenceCode }) {
  const safeReference = encodeURIComponent(String(referenceCode || '').trim());

  if (!safeReference) {
    return {
      success: false,
      status: 'reference_missing',
      error: 'No hay reference_code para eliminar la factura pendiente.',
    };
  }

  const response = await fetch(
    `${credentials.apiUrl}/v2/bills/destroy/reference/${safeReference}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  return {
    success: response.ok,
    status: response.status,
    data,
    error: response.ok
      ? null
      : data?.message || data?.error || data || `HTTP ${response.status}`,
  };
}

async function postFactusInvoiceValidate({ credentials, tokenResult, payload }) {
  const response = await fetch(`${credentials.apiUrl}/v2/bills/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `${tokenResult.tokenType} ${tokenResult.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function sendInvoiceToFactus(invoiceData) {
  try {
    const credentials = getFactusCredentials(invoiceData);
    const missing = validateCredentials(credentials);

    if (missing.length) {
      return {
        success: false,
        provider: 'factus',
        status: 'config_incomplete',
        error: `Configuración Factus incompleta. Faltan: ${missing.join(', ')}.`,
        missing,
      };
    }

    const tokenResult = await getFactusAccessToken(credentials);

    if (!tokenResult.success) {
      return {
        success: false,
        provider: 'factus',
        stage: 'auth',
        ...tokenResult,
      };
    }

    const payload = buildFactusInvoicePayload(invoiceData);

    console.log('🧾 FACTUS PAYLOAD RESUMEN:', JSON.stringify({
      reference_code: payload.reference_code,
      customer: {
        identification_document_code: payload.customer?.identification_document_code,
        legal_organization_code: payload.customer?.legal_organization_code,
        country_code: payload.customer?.country_code,
        has_municipality: Boolean(payload.customer?.municipality_code),
      },
      payment_details: payload.payment_details,
      totals: payload.totals,
      items: payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate,
        is_excluded: item.is_excluded,
      })),
    }, null, 2));

    let result = await postFactusInvoiceValidate({
      credentials,
      tokenResult,
      payload,
    });

    if (!result.ok && isFactusPendingBillConflict(result.data, result.status)) {
      console.log('⚠️ FACTUS: factura pendiente detectada. Consultando últimas facturas...');

      const listResult = await listFactusBills({
        credentials,
        tokenResult,
      });

      console.log('📋 FACTUS LIST BILLS RESULT:', JSON.stringify({
        success: listResult.success,
        status: listResult.status,
        totalFound: listResult.bills.length,
        error: listResult.error,
        bills: listResult.bills.map((bill) => ({
          id: bill.id,
          number: bill.number,
          reference_code: getBillReferenceCode(bill),
          status: bill.status,
          validated_at: bill.validated_at,
          is_validated: bill.is_validated,
        })),
      }, null, 2));

      if (!listResult.success) {
        return {
          success: false,
          provider: 'factus',
          stage: 'list_pending_invoices',
          status: listResult.status,
          error: listResult.error || 'No se pudieron consultar las facturas en Factus.',
          raw: {
            originalValidation: result.data,
            listResult: listResult.data,
          },
        };
      }

      const expectedReferenceCode = String(payload.reference_code || '').trim();
      const pendingBill = listResult.bills.find((bill) => {
        const referenceCode = String(getBillReferenceCode(bill) || '').trim();
        return (
          referenceCode &&
          referenceCode === expectedReferenceCode &&
          isPendingFactusBill(bill)
        );
      });

      if (!pendingBill) {
        return {
          success: false,
          provider: 'factus',
          stage: 'pending_invoice_not_found',
          status: result.status,
          error: `Factus informa una factura pendiente, pero no se encontró una pendiente con la referencia ${expectedReferenceCode}. No se eliminó ningún otro documento.`,
          raw: {
            originalValidation: result.data,
            bills: listResult.bills,
          },
        };
      }

      const pendingReferenceCode = getBillReferenceCode(pendingBill);

      console.log('🧾 FACTUS: factura pendiente localizada.', {
        pendingReferenceCode,
        pendingBill,
      });

      const deleteResult = await deleteFactusBillByReference({
        credentials,
        tokenResult,
        referenceCode: pendingReferenceCode,
      });

      console.log('🧹 FACTUS DELETE REAL PENDING RESULT:', JSON.stringify(deleteResult, null, 2));

      if (deleteResult.success) {
        console.log('🔁 FACTUS: reintentando envío después de eliminar factura pendiente real...', {
          reference_code: payload.reference_code,
        });

        result = await postFactusInvoiceValidate({
          credentials,
          tokenResult,
          payload,
        });
      } else {
        return {
          success: false,
          provider: 'factus',
          stage: 'delete_real_pending_invoice',
          status: deleteResult.status,
          error: deleteResult.error || 'No se pudo eliminar la factura pendiente real en Factus.',
          raw: {
            originalValidation: result.data,
            pendingBill,
            deleteResult,
          },
        };
      }
    }

    if (!result.ok) {
      console.warn('FACTUS rechazó la validación de la factura.', {
        status: result.status,
        message: trimSafe(result?.data?.message || result?.data?.error, 500),
      });

      return {
        success: false,
        provider: 'factus',
        stage: 'send_invoice',
        status: result.status,
        error:
          result.data?.message ||
          result.data?.error ||
          result.data ||
          `HTTP ${result.status}`,
        raw: result.data,
      };
    }

    const invoiceNumber =
      result?.data?.data?.number || '';

    return {
      success: true,
      provider: 'factus',
      stage: 'send_invoice',
      status: result.status,

      data: {
        ...result.data,

        invoiceNumber,
      },
    };
  } catch (error) {
    console.error('❌ ERROR FACTUS:', error.message);

    return {
      success: false,
      provider: 'factus',
      error: error.message,
    };
  }
}

module.exports = {
  deleteFactusBillByReference,
  extractFactusBillsList,
  sendInvoiceToFactus,
};
