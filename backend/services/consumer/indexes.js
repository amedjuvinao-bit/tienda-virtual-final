"use strict";
let ready;
// Production disables autoIndex. Only create this module's new indexes; never drop or synchronize other indexes.
function ensureConsumerCaseIndexes(
  Model = require("../../models/ConsumerCase"),
) {
  if (!ready)
    ready = Model.createIndexes().catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}
module.exports = { ensureConsumerCaseIndexes };
