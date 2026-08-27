const { normalizeOrderIdentity } = require('./normalizeOrderIdentity');
const { normalizeOrderItems } = require('./normalizeOrderItems');
const { normalizeOrderPayment } = require('./normalizeOrderPayment');
const {
  normalizeOrderPosInventory,
} = require('./normalizeOrderPosInventory');
const { applyOrderTimelineRetention } = require('./timelinePolicy');

function registerOrderHooks(OrderSchema) {
  OrderSchema.pre('validate', function (next) {
    try {
      normalizeOrderIdentity(this);
      const validationError = normalizeOrderItems(this);
      if (validationError) return next(validationError);
      normalizeOrderPayment(this);
      normalizeOrderPosInventory(this);
      next();
    } catch (error) {
      next(error);
    }
  });

  OrderSchema.pre('save', function (next) {
    if (this.isNew) {
      this.timeline = this.timeline || [];
      if (
        !this.timeline.some(
          (entry) => entry.type === 'status' && entry.statusTo === this.status
        )
      ) {
        this.timeline.push({
          type: 'status',
          statusFrom: undefined,
          statusTo: this.status || 'pending',
          message: 'Estado inicial',
          by: 'system',
          at: new Date(),
        });
      }

      if (this.source === 'pos') {
        this.timeline.push({
          type: 'system',
          message: 'Venta física POS creada',
          by: 'system',
          at: new Date(),
        });
      }
    }
    applyOrderTimelineRetention(this);
    next();
  });
}

module.exports = { registerOrderHooks };
