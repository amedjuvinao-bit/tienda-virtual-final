'use strict';

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);

function isLegacyAdminAuthEnabled() {
  return ENABLED_VALUES.has(
    String(process.env.ALLOW_LEGACY_ADMIN_AUTH || '')
      .trim()
      .toLowerCase()
  );
}

module.exports = {
  isLegacyAdminAuthEnabled,
};
