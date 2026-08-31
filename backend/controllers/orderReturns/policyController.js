'use strict';

const {
  getOrderReturnPolicy,
  updateOrderReturnPolicy,
} = require('../../services/orderReturnPolicyService');
const { actorFromRequest, sendServiceError } = require('./shared');

async function getReturnPolicy(_req, res) {
  try {
    return res.json({ ok: true, policy: await getOrderReturnPolicy() });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

async function putReturnPolicy(req, res) {
  try {
    const policy = await updateOrderReturnPolicy({
      payload: req.body || {},
      actor: actorFromRequest(req),
    });
    return res.json({ ok: true, policy });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = {
  getReturnPolicy,
  putReturnPolicy,
};
