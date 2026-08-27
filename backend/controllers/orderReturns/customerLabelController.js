'use strict';

const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const OrderReturn = require('../../models/OrderReturn');
const {
  SAFE_RETURN_ACCESS_ERROR,
} = require('../../services/orderReturnAccessService');
const { buildPublicAccess, sendServiceError } = require('./shared');

function drawReturnLabel(res, order, returnCase) {
  const doc = new PDFDocument({ size: 'A6', margin: 26 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${returnCase.returnNumber || 'RMA'}.pdf"`
  );
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(17).text('AUTORIZACIÓN DE DEVOLUCIÓN');
  doc.moveDown(0.6);
  doc.fontSize(13).text(returnCase.returnNumber || 'RMA');
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Orden original: ${order.orderNumber || '—'}`);
  doc.text(`Destino: ${order.branchSnapshot?.name || 'Sede asignada'}`);
  doc.text(
    `Unidades autorizadas: ${(returnCase.items || []).reduce(
      (sum, item) => sum + Number(item.authorizedQuantity || 0),
      0
    )}`
  );
  if (returnCase.shipping?.carrierName) {
    doc.text(`Transportadora: ${returnCase.shipping.carrierName}`);
  }
  if (returnCase.shipping?.trackingNumber) {
    doc.text(`Guía: ${returnCase.shipping.trackingNumber}`);
  }
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').text('Instrucciones');
  doc.font('Helvetica').text(
    returnCase.shipping?.instructions ||
      'Adjunta este documento al paquete y conserva el comprobante de entrega.'
  );
  doc.moveDown(0.8);
  doc.fontSize(7).fillColor('#555555').text(
    'Este documento identifica el expediente RMA. Solo es una guía de transportadora cuando incluye empresa y número de seguimiento.'
  );
  doc.end();
}

async function getCustomerReturnLabel(req, res) {
  try {
    const access = await buildPublicAccess(req, req.params.id);
    if (!access.allowed) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    if (!mongoose.Types.ObjectId.isValid(String(req.params.returnId || ''))) {
      return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    }
    const returnCase = await OrderReturn.findOne({
      _id: req.params.returnId,
      order: access.order._id,
      status: {
        $in: [
          'authorized',
          'in_transit',
          'received',
          'resolution_required',
          'resolved',
        ],
      },
    }).lean();
    if (!returnCase) return res.status(404).json(SAFE_RETURN_ACCESS_ERROR);
    if (/^https:\/\//i.test(String(returnCase.shipping?.labelUrl || ''))) {
      return res.redirect(302, returnCase.shipping.labelUrl);
    }
    return drawReturnLabel(res, access.order, returnCase);
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = {
  drawReturnLabel,
  getCustomerReturnLabel,
};
