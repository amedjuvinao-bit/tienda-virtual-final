'use strict';

module.exports = {
  key: { isDefault: 1, deletedAt: 1 },
  options: {
    name: 'admin_roles_one_default_v1',
    unique: true,
    partialFilterExpression: { isDefault: true, deletedAt: null },
  },
};
