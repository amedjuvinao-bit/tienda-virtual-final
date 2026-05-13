// backend/lib/dian/xmlGenerator.js
const { create } = require('xmlbuilder2');

function roundMoney(value) {
  return Math.round(Number(value || 0));
}

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getDianEnabled(settings = {}) {
  return settings?.billing?.dian?.enabled === true;
}

function getSoftwareSecurityCode(settings = {}) {
  return (
    settings?.billing?.dian?.softwareSecurityCode ||
    settings?.billing?.dian?.securityCode ||
    ''
  );
}

function generateInvoiceXML({ order, settings, cufeData }) {
  try {
    const now = new Date();

    const dianEnabled = getDianEnabled(settings);

    const issueDate = now.toISOString().slice(0, 10);
    const issueTime = now.toISOString().slice(11, 19);

    const dianResolution = settings?.billing?.dianResolution || {};
    const fiscalInfo = settings?.billing?.fiscalInfo || {};
    const dianConfig = settings?.billing?.dian || {};

    const prefix = dianResolution?.prefix || 'FE';
    const invoiceNumber = `${prefix}${order.orderNumber}`;

    const ivaConfig = order?.taxes?.iva || settings?.billing?.taxes?.iva || {};
    const ivaEnabled = ivaConfig.enabled !== false;
    const ivaPercent = Number(ivaConfig.percent || 0);
    const ivaCode = ivaConfig.code || '01';
    const ivaName = ivaConfig.name || 'IVA';

    const dianQrUrl = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufeData?.cufe || ''}`;

    console.log(
      dianEnabled
        ? '✅ XML GENERATOR MODO DIAN ACTIVO:'
        : '✅ XML GENERATOR MODO INTERNO ACTIVO:',
      dianQrUrl
    );

    const items = order.items || order.cart || [];

    const subtotal = roundMoney(order.subtotal || 0);
    const shipping = roundMoney(order.shipping || 0);
    const taxAmount =
      typeof ivaConfig.amount === 'number'
        ? roundMoney(ivaConfig.amount)
        : ivaEnabled
          ? roundMoney((subtotal * ivaPercent) / 100)
          : 0;

    const totalWithTax = roundMoney(order.total || subtotal + taxAmount + shipping);

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'xmlns:sts': 'dian:gov:co:facturaelectronica:Structures-2-1',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      });

    const ext = doc.ele('ext:UBLExtensions');

    const ext1 = ext.ele('ext:UBLExtension');
    const extContent1 = ext1.ele('ext:ExtensionContent');
    const dianExt = extContent1.ele('sts:DianExtensions');

    const invoiceControl = dianExt.ele('sts:InvoiceControl');

    invoiceControl
      .ele('sts:InvoiceAuthorization')
      .txt(dianResolution?.resolutionNumber || '');

    const authorizationPeriod = invoiceControl.ele('sts:AuthorizationPeriod');
    authorizationPeriod
      .ele('cbc:StartDate')
      .txt(dianResolution?.resolutionDate || '');
    authorizationPeriod
      .ele('cbc:EndDate')
      .txt(dianResolution?.expirationDate || '');

    const authorizedInvoices = invoiceControl.ele('sts:AuthorizedInvoices');
    authorizedInvoices
      .ele('sts:Prefix')
      .txt(dianResolution?.prefix || '');
    authorizedInvoices
      .ele('sts:From')
      .txt(dianResolution?.rangeFrom || '');
    authorizedInvoices
      .ele('sts:To')
      .txt(dianResolution?.rangeTo || '');

    if (dianEnabled) {
      const invoiceSource = dianExt.ele('sts:InvoiceSource');

      invoiceSource
        .ele('cbc:IdentificationCode', {
          listAgencyID: '6',
          listAgencyName: 'United Nations Economic Commission for Europe',
          listSchemeURI: 'urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1',
        })
        .txt('CO');

      const softwareProvider = dianExt.ele('sts:SoftwareProvider');

      softwareProvider
        .ele('sts:ProviderID', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
          schemeID: fiscalInfo?.dv || dianConfig?.providerDv || '',
          schemeName: '31',
        })
        .txt(fiscalInfo?.nit || dianConfig?.providerNit || '');

      softwareProvider
        .ele('sts:SoftwareID', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
        })
        .txt(dianConfig?.softwareId || '');

      dianExt
        .ele('sts:SoftwareSecurityCode', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
        })
        .txt(getSoftwareSecurityCode(settings));

      const authorizationProvider = dianExt.ele('sts:AuthorizationProvider');

      authorizationProvider
        .ele('sts:AuthorizationProviderID', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
          schemeID: '4',
          schemeName: '31',
        })
        .txt('800197268');
    }

    dianExt.ele('sts:QRCode').txt(dianQrUrl);

    const ext2 = ext.ele('ext:UBLExtension');
    ext2.ele('ext:ExtensionContent').ele('ds:Signature').txt('');

    doc.ele('cbc:UBLVersionID').txt('UBL 2.1');
    doc.ele('cbc:CustomizationID').txt(dianEnabled ? '10' : '10');
    doc.ele('cbc:ProfileID').txt(
      dianEnabled
        ? 'DIAN 2.1: Factura Electrónica de Venta'
        : 'Documento comercial interno compatible con estructura UBL'
    );
    doc.ele('cbc:ProfileExecutionID').txt(dianResolution?.environment || '2');

    doc.ele('cbc:ID').txt(invoiceNumber);

    doc.ele('cbc:UUID', {
      schemeName: 'CUFE-SHA384',
      schemeID: dianResolution?.environment || '2',
    }).txt(cufeData?.cufe || '');

    doc.ele('cbc:IssueDate').txt(issueDate);
    doc.ele('cbc:IssueTime').txt(issueTime);
    doc.ele('cbc:InvoiceTypeCode').txt('01');
    doc.ele('cbc:DocumentCurrencyCode').txt('COP');

    // =========================
    // PROVEEDOR
    // =========================
    const supplier = doc.ele('cac:AccountingSupplierParty');
    const supplierParty = supplier.ele('cac:Party');

    const supplierName =
      fiscalInfo?.businessName ||
      settings?.store?.businessName ||
      settings?.store?.name ||
      'MI EMPRESA SAS';

    supplierParty
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(supplierName);

    if (dianEnabled) {
      const physicalLocation = supplierParty.ele('cac:PhysicalLocation');
      const address = physicalLocation.ele('cac:Address');

      address.ele('cbc:ID').txt(fiscalInfo?.cityCode || fiscalInfo?.municipalityCode || '');
      address.ele('cbc:CityName').txt(fiscalInfo?.city || '');
      address.ele('cbc:CountrySubentity').txt(fiscalInfo?.department || '');
      address.ele('cbc:CountrySubentityCode').txt(fiscalInfo?.departmentCode || '');

      const addressLine = address.ele('cac:AddressLine');
      addressLine.ele('cbc:Line').txt(fiscalInfo?.address || '');

      const country = address.ele('cac:Country');
      country.ele('cbc:IdentificationCode').txt('CO');
      country.ele('cbc:Name', { languageID: 'es' }).txt('Colombia');
    }

    const supplierTaxScheme = supplierParty.ele('cac:PartyTaxScheme');

    if (dianEnabled) {
      supplierTaxScheme
        .ele('cbc:RegistrationName')
        .txt(supplierName);

      supplierTaxScheme
        .ele('cbc:CompanyID', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
          schemeID: fiscalInfo?.dv || '',
          schemeName: '31',
        })
        .txt(fiscalInfo?.nit || '900000000');

      supplierTaxScheme
        .ele('cbc:TaxLevelCode', {
          listName: fiscalInfo?.taxResponsibility || fiscalInfo?.responsibilityCode || 'R-99-PN',
        })
        .txt(fiscalInfo?.taxLevelCode || fiscalInfo?.responsibilityCode || 'R-99-PN');

      const supplierTaxSchemeNode = supplierTaxScheme.ele('cac:TaxScheme');
      supplierTaxSchemeNode.ele('cbc:ID').txt(ivaCode);
      supplierTaxSchemeNode.ele('cbc:Name').txt(ivaName);
    } else {
      supplierTaxScheme
        .ele('cbc:CompanyID')
        .txt(fiscalInfo?.nit || '900000000');
    }

    // =========================
    // CLIENTE
    // =========================
    const customer = doc.ele('cac:AccountingCustomerParty');
    const customerParty = customer.ele('cac:Party');

    const customerName = `${order?.customer?.name || ''} ${order?.customer?.lastname || ''}`.trim() || 'CONSUMIDOR FINAL';
    const customerDocument = order?.customer?.id || '222222222222';

    customerParty
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(customerName);

    if (dianEnabled) {
      const customerPhysicalLocation = customerParty.ele('cac:PhysicalLocation');
      const customerAddress = customerPhysicalLocation.ele('cac:Address');

      customerAddress.ele('cbc:ID').txt(order?.customer?.cityCode || '');
      customerAddress.ele('cbc:CityName').txt(order?.customer?.city || '');
      customerAddress.ele('cbc:CountrySubentity').txt(order?.customer?.department || '');
      customerAddress.ele('cbc:CountrySubentityCode').txt(order?.customer?.departmentCode || '');

      const customerAddressLine = customerAddress.ele('cac:AddressLine');
      customerAddressLine.ele('cbc:Line').txt(order?.customer?.address || '');

      const customerCountry = customerAddress.ele('cac:Country');
      customerCountry.ele('cbc:IdentificationCode').txt('CO');
      customerCountry.ele('cbc:Name', { languageID: 'es' }).txt('Colombia');
    }

    const customerTaxScheme = customerParty.ele('cac:PartyTaxScheme');

    if (dianEnabled) {
      customerTaxScheme
        .ele('cbc:RegistrationName')
        .txt(customerName);

      customerTaxScheme
        .ele('cbc:CompanyID', {
          schemeAgencyID: '195',
          schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
          schemeName: order?.customer?.documentType || '13',
        })
        .txt(customerDocument);

      const customerTaxSchemeNode = customerTaxScheme.ele('cac:TaxScheme');
      customerTaxSchemeNode.ele('cbc:ID').txt(ivaCode);
      customerTaxSchemeNode.ele('cbc:Name').txt(ivaName);
    } else {
      customerTaxScheme
        .ele('cbc:CompanyID')
        .txt(customerDocument);
    }

    // =========================
    // FORMA Y MEDIO DE PAGO
    // =========================
    if (dianEnabled) {
      const paymentMeans = doc.ele('cac:PaymentMeans');

      paymentMeans
        .ele('cbc:ID')
        .txt(order?.payment?.formCode || '1');

      paymentMeans
        .ele('cbc:PaymentMeansCode')
        .txt(order?.payment?.meansCode || '10');

      paymentMeans
        .ele('cbc:PaymentDueDate')
        .txt(issueDate);
    }

    // =========================
    // IMPUESTOS (SOLO SI ACTIVO)
    // =========================
    if (ivaEnabled) {
      const taxTotal = doc.ele('cac:TaxTotal');

      taxTotal
        .ele('cbc:TaxAmount', { currencyID: 'COP' })
        .txt(taxAmount);

      const taxSubtotal = taxTotal.ele('cac:TaxSubtotal');

      taxSubtotal
        .ele('cbc:TaxableAmount', { currencyID: 'COP' })
        .txt(subtotal);

      taxSubtotal
        .ele('cbc:TaxAmount', { currencyID: 'COP' })
        .txt(taxAmount);

      const taxCategory = taxSubtotal.ele('cac:TaxCategory');

      taxCategory
        .ele('cbc:Percent')
        .txt(ivaPercent);

      const taxScheme = taxCategory.ele('cac:TaxScheme');

      taxScheme
        .ele('cbc:ID')
        .txt(ivaCode);

      taxScheme
        .ele('cbc:Name')
        .txt(ivaName);
    }

    // =========================
    // TOTALES
    // =========================
    const monetaryTotal = doc.ele('cac:LegalMonetaryTotal');

    monetaryTotal
      .ele('cbc:LineExtensionAmount', { currencyID: 'COP' })
      .txt(subtotal);

    monetaryTotal
      .ele('cbc:TaxExclusiveAmount', { currencyID: 'COP' })
      .txt(subtotal);

    monetaryTotal
      .ele('cbc:TaxInclusiveAmount', { currencyID: 'COP' })
      .txt(totalWithTax);

    monetaryTotal
      .ele('cbc:PayableAmount', { currencyID: 'COP' })
      .txt(totalWithTax);

    // =========================
    // ITEMS
    // =========================
    items.forEach((item, index) => {
      const quantity = Number(item.quantity || item.qty || 1);
      const priceValue = roundMoney(item.price || item.unitPrice || item.priceNumber || item?.product?.price || 0);
      const lineSubtotal = roundMoney(priceValue * quantity);
      const lineTaxAmount = ivaEnabled ? roundMoney((lineSubtotal * ivaPercent) / 100) : 0;
      const sku = safeText(item.sku || item.product?.sku || item.productId || item._id || `ITEM-${index + 1}`);

      const line = doc.ele('cac:InvoiceLine');

      line.ele('cbc:ID').txt(index + 1);

      if (dianEnabled) {
        line.ele('cbc:InvoicedQuantity', { unitCode: item.unitCode || 'EA' }).txt(quantity);
      } else {
        line.ele('cbc:InvoicedQuantity').txt(quantity);
      }

      line.ele('cbc:LineExtensionAmount', { currencyID: 'COP' }).txt(lineSubtotal);

      // 🔥 SOLO SI HAY IVA
      if (ivaEnabled) {
        const lineTaxTotal = line.ele('cac:TaxTotal');

        lineTaxTotal
          .ele('cbc:TaxAmount', { currencyID: 'COP' })
          .txt(lineTaxAmount);

        const lineTaxSubtotal = lineTaxTotal.ele('cac:TaxSubtotal');

        lineTaxSubtotal
          .ele('cbc:TaxableAmount', { currencyID: 'COP' })
          .txt(lineSubtotal);

        lineTaxSubtotal
          .ele('cbc:TaxAmount', { currencyID: 'COP' })
          .txt(lineTaxAmount);

        const lineTaxCategory = lineTaxSubtotal.ele('cac:TaxCategory');

        lineTaxCategory
          .ele('cbc:Percent')
          .txt(ivaPercent);

        const lineTaxScheme = lineTaxCategory.ele('cac:TaxScheme');

        lineTaxScheme
          .ele('cbc:ID')
          .txt(ivaCode);

        lineTaxScheme
          .ele('cbc:Name')
          .txt(ivaName);
      }

      const itemNode = line.ele('cac:Item');

      itemNode
        .ele('cbc:Description')
        .txt(item.title || item.product?.title || 'Producto');

      if (dianEnabled) {
        itemNode
          .ele('cac:SellersItemIdentification')
          .ele('cbc:ID')
          .txt(sku);
      }

      line
        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: 'COP' })
        .txt(priceValue);
    });

    return doc.end({ prettyPrint: true });
  } catch (error) {
    console.error('❌ Error generando XML DIAN:', error);
    throw error;
  }
}

module.exports = {
  generateInvoiceXML,
};