'use strict';

// backend/routes/adminCoupons.js
const express = require('express');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');
const couponService = require('../services/couponService');

const router = express.Router();

function sendError(res, error, fallback = 'Error procesando cupones.') {
  const status = Number(error?.status || error?.statusCode || 500);
  return res.status(status).json({
    ok: false,
    error: error?.code || 'COUPON_ADMIN_ERROR',
    message: error?.message || fallback,
  });
}

function getActor(req) {
  return {
    adminUserId: req.adminUserId || req.adminUserDoc?._id || null,
    snapshot: {
      username: req.adminUser || req.adminUserDoc?.username || '',
      displayName: req.adminUserDoc?.displayName || req.adminName || '',
      role: req.adminRole || '',
      adminRole: req.adminRole || '',
    },
  };
}

router.use(requireAdmin);

router.get(
  '/',
  requirePermission.any(['coupons:view', 'orders:view', 'finance:view']),
  async (req, res) => {
    try {
      const data = await couponService.listCoupons(req.query || {});
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error listando cupones.');
    }
  }
);

router.get(
  '/:id',
  requirePermission.any(['coupons:view', 'orders:view', 'finance:view']),
  async (req, res) => {
    try {
      const data = await couponService.getCouponById(req.params.id);
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error obteniendo cupón.');
    }
  }
);

router.post(
  '/',
  requirePermission('coupons:create'),
  async (req, res) => {
    try {
      const data = await couponService.createCoupon(req.body || {}, getActor(req));
      res.status(201).json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error creando cupón.');
    }
  }
);

router.post(
  '/validate',
  requirePermission.any(['coupons:view', 'coupons:update', 'orders:create']),
  async (req, res) => {
    try {
      const data = await couponService.validateCoupon(req.body || {});
      res.status(data.valid ? 200 : 422).json({ ok: data.valid === true, data });
    } catch (error) {
      sendError(res, error, 'Error validando cupón.');
    }
  }
);

router.put(
  '/:id',
  requirePermission('coupons:update'),
  async (req, res) => {
    try {
      const data = await couponService.updateCoupon(req.params.id, req.body || {}, getActor(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error actualizando cupón.');
    }
  }
);

router.patch(
  '/:id/status',
  requirePermission('coupons:update'),
  async (req, res) => {
    try {
      const data = await couponService.setCouponStatus(req.params.id, req.body || {}, getActor(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error cambiando estado del cupón.');
    }
  }
);

router.delete(
  '/:id',
  requirePermission('coupons:delete'),
  async (req, res) => {
    try {
      const data = await couponService.deleteCoupon(req.params.id, getActor(req));
      res.json({ ok: true, data });
    } catch (error) {
      sendError(res, error, 'Error eliminando cupón.');
    }
  }
);

module.exports = router;
