// backend/routes/orders.js
const express = require('express');
const router = express.Router();

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const {
  requireOrderBulkActionPermission,
} = require('../middleware/orderBulkActionPermission');
const { rateLimit } = require('../middleware/orderCreationRateLimit');
const {
  requireAuthorizedOrderCart,
} = require('../services/authorizedCartOrderService');
const { createOrder } = require('../controllers/orderCreationController');
const {
  listAdminOrders,
} = require('../controllers/orderAdminQueryController');
const {
  getOrderOperationalHealth,
} = require('../controllers/orderOperationalMonitoringController');
const {
  cancelShipmentLabel,
  confirmShipmentDropoff,
  generateShipmentLabel,
  getOrderLogistics,
  initializeLogistics,
  quoteShipment,
  scheduleShipmentPickup,
  shippingProviders,
  syncShipmentTracking,
  testShipmentWebhook,
  updateShipment,
} = require('../controllers/orderLogisticsController');
const {
  getPublicOrderThanks,
} = require('../controllers/orderPublicThanksController');
const {
  updateOrderFulfillmentService,
} = require('../controllers/orderFulfillmentServiceController');
const {
  getAdminOrderDetail,
} = require('../controllers/orderAdminDetailController');
const {
  updateOrderArchived,
  updateOrderPrinted,
  updateOrderStatus,
  updateOrderTags,
} = require('../controllers/orderAdminMutationController');
const {
  updateOrderCustomerData,
} = require('../controllers/orderCustomerDataController');
const {
  createOrderNote,
  deleteOrderNote,
  listOrderNotes,
  listOrderTimeline,
  updateOrderNote,
} = require('../controllers/orderNotesTimelineController');
const {
  downloadOrderInvoicePdf,
  downloadOrderInvoiceXml,
  downloadOrderReceiptPdf,
} = require('../controllers/orderDocumentsController');
const {
  automateOrderRefundReconciliation,
  confirmOrderRefundPayment,
  createOrderRefund,
  getOrderRefunds,
} = require('../controllers/orderRefundController');
const {
  applyOrderBulkAction,
} = require('../controllers/orderBulkController');
const {
  exportSelectedOrders,
} = require('../controllers/orderExportController');
const {
  confirmOrderManualPayment,
} = require('../controllers/orderManualPaymentController');


router.use('/admin', requireAdmin);

/* GET /api/orders/admin: consulta paginada y métricas en un servicio aislado. */
router.get('/admin', listAdminOrders);

router.get('/admin/operations/health', getOrderOperationalHealth);

router.get(
  '/admin/shipping/providers',
  requireAdmin,
  requirePermission('orders:view'),
  shippingProviders
);

router.get(
  '/:id/fulfillment/logistics',
  requireAdmin,
  requirePermission('orders:view'),
  getOrderLogistics
);

router.post(
  '/:id/fulfillment/logistics/initialize',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  initializeLogistics
);

router.patch(
  '/:id/fulfillment/logistics/shipments/:shipmentId',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  updateShipment
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/rates',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  quoteShipment
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/label',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  generateShipmentLabel
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/tracking/sync',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  syncShipmentTracking
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/pickup',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  scheduleShipmentPickup
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/webhook/test',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  testShipmentWebhook
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/handoff/dropoff',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  confirmShipmentDropoff
);

router.post(
  '/:id/fulfillment/logistics/shipments/:shipmentId/label/cancel',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  cancelShipmentLabel
);

/* ============================
 * GET /api/orders/:id/thanks
 * ============================ */
router.get('/:id/thanks', getPublicOrderThanks);

/* ============================
 * GET /api/orders/:id
 * ============================ */
router.patch(
  '/:id/fulfillment/services/:serviceId',
  requireAdmin,
  requirePermission('orders:fulfillment'),
  updateOrderFulfillmentService
);

router.get(
  '/:id',
  requireAdmin,
  requirePermission('orders:view'),
  getAdminOrderDetail
);

/* ============================
 * PATCH /api/orders/:id/status
 * ============================ */
router.options('/:id/status', (_req, res) => res.sendStatus(204));

router.patch(
  '/:id/status',
  requireAdmin,
  requirePermission('orders:status'),
  updateOrderStatus
);

router.post(
  '/:id/payments/manual-confirmation',
  requireAdmin,
  requirePermission('orders:confirm_manual_payment'),
  confirmOrderManualPayment
);

/* ============================
 * PATCH /api/orders/:id/printed
 * ============================ */
router.options('/:id/printed', (_req, res) => res.sendStatus(204));

router.patch('/:id/printed', requireAdmin, updateOrderPrinted);

/* ============================
 * PATCH /api/orders/:id/archived
 * ============================ */
router.options('/:id/archived', (_req, res) => res.sendStatus(204));

router.patch('/:id/archived', requireAdmin, updateOrderArchived);

/* ============================
 * PATCH /api/orders/:id/customer-data
 * ============================ */
router.patch('/:id/customer-data', requireAdmin, updateOrderCustomerData);

/* =========================================================
 * PUT /api/orders/:id/tags
 * ======================================================= */
router.put('/:id/tags', requireAdmin, updateOrderTags);

/* ============================
 * POST /api/orders
 * ============================ */
router.post('/', rateLimit, requireAuthorizedOrderCart, createOrder);

/* =========================================================
 * Notas internas
 * ======================================================= */
router.get('/:id/notes', requireAdmin, listOrderNotes);
router.post('/:id/notes', requireAdmin, createOrderNote);
router.patch('/:id/notes/:noteId', requireAdmin, updateOrderNote);
router.delete('/:id/notes/:noteId', requireAdmin, deleteOrderNote);

/* =========================================================
 * Timeline
 * ======================================================= */
router.get('/:id/timeline', requireAdmin, listOrderTimeline);

/* =========================================================
 * XML FACTURA ELECTRÓNICA
 * GET /api/orders/:id/invoice-xml
 * ======================================================= */
router.get(
  '/:id/invoice-xml',
  requireAdmin,
  requirePermission('billing:download'),
  downloadOrderInvoiceXml
);
/* =========================================================
 * PDF INTERNO DE LA ORDEN
 * Conserva el comprobante comercial detallado aunque la
 * factura electrónica todavía no exista o haya fallado.
 * ======================================================= */
router.get(
  '/:id/receipt-pdf',
  requireAdmin,
  requirePermission('billing:download'),
  downloadOrderReceiptPdf
);

/* =========================================================
 * PDF OFICIAL DE FACTUS
 * ======================================================= */
router.get(
  '/:id/pdf',
  requireAdmin,
  requirePermission('billing:download'),
  downloadOrderInvoicePdf
);

/* =========================================================
 * Reembolso
 * ======================================================= */
router.options('/:id/refund', (_req, res) => res.sendStatus(204));

router.post(
  '/:id/refund',
  requireAdmin,
  requirePermission('orders:refund'),
  createOrderRefund
);

router.get(
  '/:id/refunds',
  requireAdmin,
  requirePermission('orders:view'),
  getOrderRefunds
);

router.options('/:id/refunds/:refundId/confirm-payment', (_req, res) =>
  res.sendStatus(204)
);

router.post(
  '/:id/refunds/:refundId/confirm-payment',
  requireAdmin,
  requirePermission('orders:refund'),
  confirmOrderRefundPayment
);

router.options('/:id/refunds/:refundId/automate', (_req, res) =>
  res.sendStatus(204)
);

router.post(
  '/:id/refunds/:refundId/automate',
  requireAdmin,
  requirePermission('orders:refund'),
  requirePermission('billing:credit_note'),
  automateOrderRefundReconciliation
);

/* =========================================================
 * POST /api/orders/admin/bulk
 * ======================================================= */
router.post(
  '/admin/bulk',
  requireAdmin,
  requireOrderBulkActionPermission,
  applyOrderBulkAction
);

/* =========================================================
 * POST /api/orders/admin/export
 * ======================================================= */
router.post(
  '/admin/export',
  requireAdmin,
  requirePermission.all(['orders:view', 'orders:export']),
  exportSelectedOrders
);

module.exports = router;
