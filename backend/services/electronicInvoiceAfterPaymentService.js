// backend/services/electronicInvoiceAfterPaymentService.js

const SiteSettings = require('../models/SiteSettings');
const Order = require('../models/Order');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const { generateCUFE } = require('../lib/dian/cufe');
const { generateInvoiceXML } = require('../lib/dian/xmlGenerator');
const { sendElectronicInvoiceToProvider } = require('../lib/dian/providerAdapter');

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function readPaymentMethodFromTransaction(transaction = {}) {
  const rawMethod = transaction?.payment_method || transaction?.rawMethod || {};

  return {
    methodType:
      trimSafe(transaction?.payment_method_type, 80) ||
      trimSafe(transaction?.paymentMethodType, 80) ||
      trimSafe(rawMethod?.type, 80),
    method:
      trimSafe(transaction?.payment_method_name, 120) ||
      trimSafe(transaction?.payment_method, 120) ||
      trimSafe(transaction?.paymentMethod, 120) ||
      trimSafe(rawMethod?.type, 120),
    methodLabel:
      trimSafe(transaction?.payment_method_name, 120) ||
      trimSafe(transaction?.payment_method_type, 120) ||
      trimSafe(transaction?.paymentMethodType, 120) ||
      trimSafe(rawMethod?.type, 120),
    rawMethod,
  };
}

async function generateElectronicInvoiceAfterPayment({
  orderId,
  transaction = {},
  payments = {},
  paymentProvider = '',
} = {}) {
  try {
    const order = await Order.findById(orderId).lean();

    if (!order) {
      console.warn('⚠️ Facturación electrónica omitida: orden no encontrada después del pago.', {
        orderId: String(orderId || ''),
        paymentProvider,
      });
      return null;
    }

    if (order.payment?.status !== 'paid') {
      console.log('ℹ️ Facturación electrónica omitida: la orden no está pagada.', {
        orderNumber: order.orderNumber,
        paymentStatus: order.payment?.status || '',
        paymentProvider,
      });
      return null;
    }

    const settingsDoc = await SiteSettings.findOne().lean();
    const billingConfig = settingsDoc?.billing || {};
    const dianConfig = billingConfig?.dian || {};
    const electronicProvider = billingConfig?.electronicProvider || {};
    const selectedProvider = String(electronicProvider?.provider || 'mock')
      .trim()
      .toLowerCase();

    const isElectronicBillingActive =
      dianConfig?.enabled === true &&
      String(dianConfig?.mode || 'internal') !== 'internal';

    if (!isElectronicBillingActive || selectedProvider === 'mock') {
      console.log('ℹ️ Facturación electrónica omitida: modo interno/mock activo.', {
        orderNumber: order.orderNumber,
        provider: selectedProvider,
        dianMode: dianConfig?.mode || 'internal',
        paymentProvider,
      });
      return null;
    }

    const existingInvoice = await ElectronicInvoice.findOne({ orderId: order._id }).lean();

    if (existingInvoice?.status === 'generated' && existingInvoice?.cufe) {
      console.log('ℹ️ Facturación electrónica omitida: factura ya generada.', {
        orderNumber: order.orderNumber,
        cufe: existingInvoice.cufe,
        paymentProvider,
      });
      return existingInvoice;
    }

    const now = new Date();
    const issueDate = now.toISOString().slice(0, 10);
    const issueTime = now.toISOString().slice(11, 19);

    const cufeData = generateCUFE({
      invoiceNumber: order.orderNumber,
      issueDate,
      issueTime,
      grossAmount: order.subtotal,
      taxAmount: order.taxes?.iva?.amount || 0,
      totalAmount: order.total,
      companyNit: billingConfig?.fiscalInfo?.nit || '',
      customerDocument: order.customer?.id || '',
      technicalKey:
        billingConfig?.dianResolution?.technicalKey ||
        billingConfig?.dian?.technicalKey ||
        '',
      environment:
        billingConfig?.dianResolution?.environment ||
        billingConfig?.dian?.environment ||
        '2',
    });

    const xml = generateInvoiceXML({
      order,
      settings: settingsDoc,
      cufeData,
    });

    const transactionPayment = readPaymentMethodFromTransaction(transaction);

    const providerInvoiceData = {
      order: {
        ...order,
        payment: {
          ...(order.payment || {}),
          methodType: order.payment?.methodType || transactionPayment.methodType || '',
          method: order.payment?.method || transactionPayment.method || '',
          methodLabel: order.payment?.methodLabel || transactionPayment.methodLabel || '',
          rawMethod: order.payment?.rawMethod || transactionPayment.rawMethod || {},
        },
      },
      settings: settingsDoc,
      cufeData,
      xmlContent: xml,
      provider: selectedProvider,
      providerConfig: electronicProvider,
    };

    let providerResponse = null;
    let providerData = null;
    let providerInvoiceNumber = order.orderNumber;
    let providerCufe = cufeData.cufe;

    try {
      providerResponse = await sendElectronicInvoiceToProvider({
        provider: selectedProvider,
        invoiceData: providerInvoiceData,
      });
    } catch (err) {
      providerResponse = {
        success: false,
        error: err.message,
      };
      console.error('❌ Error enviando factura electrónica al proveedor:', {
        orderNumber: order.orderNumber,
        paymentProvider,
        error: err.message,
      });
    }

    if (providerResponse?.success === true) {
      providerData = providerResponse?.data?.data || providerResponse?.data || null;
      providerInvoiceNumber = providerData?.number || order.orderNumber;
      providerCufe = providerData?.cufe || cufeData.cufe;
    }

    const updatedInvoice = await ElectronicInvoice.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          invoiceNumber: providerInvoiceNumber,
          required: true,
          status: providerResponse?.success === true ? 'generated' : 'provider_error',
          customer: order.customer || {},
          fiscalInfo: billingConfig?.fiscalInfo || {},
          dianResolution: billingConfig?.dianResolution || {},
          legalTexts: billingConfig?.legalTexts || {},
          cufe: providerCufe,
          xmlContent: xml,
          qrUrl: cufeData.qrUrl,
          pdfUrl:
            providerData?.links?.pdf ||
            providerData?.links?.pdf_url ||
            '',
          xmlUrl:
            providerData?.links?.xml ||
            providerData?.links?.xml_url ||
            '',
          provider: {
            name: selectedProvider,
            status: providerResponse?.data?.status || '',
            referenceCode: providerData?.reference_code || order.orderNumber,
            number: providerData?.number || providerInvoiceNumber,
            cufe: providerData?.cufe || providerCufe,
            isValidated: providerData?.is_validated === true,
            validatedAt: providerData?.validated_at || '',
            links: providerData?.links || {},
            raw: providerData || {},
          },
          generatedAt: now,
          dianResponse: {
            stage: 'generated_after_payment_approved_provider_ready',
            paymentProvider: paymentProvider || order.payment?.provider || '',
            transactionId:
              trimSafe(transaction?.id, 120) ||
              trimSafe(transaction?.transaction_id, 120) ||
              trimSafe(transaction?.transactionId, 120) ||
              trimSafe(order.payment?.transactionId, 120),
            environment:
              billingConfig?.dianResolution?.environment ||
              billingConfig?.dian?.environment ||
              '2',
            issueDate,
            issueTime,
            paymentMode: payments?.mode || '',
            providerPrepared: selectedProvider,
            providerResponse: providerResponse || null,
          },
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    if (providerResponse?.success === true) {
      console.log('✅ Factura electrónica generada después del pago.', {
        orderNumber: order.orderNumber,
        cufe: providerCufe,
        provider: selectedProvider,
        paymentProvider,
      });
    } else {
      console.log('⚠️ Factura electrónica pendiente/error proveedor después del pago.', {
        orderNumber: order.orderNumber,
        cufe: cufeData.cufe,
        provider: selectedProvider,
        paymentProvider,
        providerStatus: providerResponse?.status || null,
        providerError: providerResponse?.error || null,
      });
    }

    return updatedInvoice;
  } catch (err) {
    console.error('❌ Error generando factura electrónica post pago:', {
      orderId: String(orderId || ''),
      paymentProvider,
      error: err.message,
    });
    return null;
  }
}

module.exports = {
  generateElectronicInvoiceAfterPayment,
};
