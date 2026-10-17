'use strict';

const SiteSettings = require('../models/SiteSettings');

function isAppearanceWrite(permissions = []) {
  return permissions.some((permission) => permission.startsWith('appearance:'));
}

// Documents created before the revision field was introduced start at version zero.
function appearanceVersionFilter(id, revision) {
  return {
    _id: id,
    ...(revision === 0
      ? { $or: [{ appearanceRevision: 0 }, { appearanceRevision: { $exists: false } }] }
      : { appearanceRevision: revision }),
  };
}

async function updateAppearanceWithRevision({ id, revision, changes, model = SiteSettings }) {
  return model.findOneAndUpdate(
    appearanceVersionFilter(id, revision),
    { $set: changes, $inc: { appearanceRevision: 1 } },
    { new: true, strict: false, runValidators: false }
  ).lean();
}

module.exports = { isAppearanceWrite, appearanceVersionFilter, updateAppearanceWithRevision };
