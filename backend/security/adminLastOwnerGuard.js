'use strict';

const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

const GUARD_ID = 'active-owner';

// Every operation that removes an active owner writes the same document inside
// the transaction. Concurrent removals therefore conflict and retry the count.
async function saveRemovingOwner(user, { invalidateSessions = true } = {}) {
  const guard = mongoose.connection.db.collection('admin_owner_guards');
  try {
    await guard.updateOne(
      { _id: GUARD_ID },
      { $setOnInsert: { revision: 0 } },
      { upsert: true }
    );
  } catch (error) {
    // Two first requests can try to create the guard at the same time.
    if (error?.code !== 11000) throw error;
  }

  await mongoose.connection.transaction(async (session) => {
    await guard.updateOne(
      { _id: GUARD_ID },
      { $inc: { revision: 1 } },
      { session }
    );

    const ownersLeft = await AdminUser.countDocuments({
      _id: { $ne: user._id },
      deletedAt: null,
      active: true,
      status: 'active',
      role: 'owner',
    }).session(session);

    if (ownersLeft < 1) {
      const error = new Error('No puedes dejar el sistema sin un propietario activo.');
      error.status = 400;
      throw error;
    }

    if (invalidateSessions) {
      await user.invalidateSessions({ session });
    } else {
      await user.save({ session });
    }
  });
}

module.exports = { saveRemovingOwner };
