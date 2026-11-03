"use strict";

const EMAIL_INDEX_OPTIONS = {
  name: "subscriber_email_consent_unique_v1",
  unique: true,
  partialFilterExpression: { email: { $type: "string", $gt: "" } },
};
const initialized = new WeakMap();
function coversEmail(index) {
  if (
    index.unique !== true ||
    Object.keys(index.key || {}).length !== 1 ||
    ![1, -1].includes(index.key.email)
  )
    return false;
  const partial = index.partialFilterExpression;
  if (!partial) return true;
  if (
    Object.keys(partial).length !== 1 ||
    !partial.email ||
    typeof partial.email !== "object"
  )
    return false;
  return (
    Object.keys(partial.email).length > 0 &&
    Object.entries(partial.email).every(
      ([key, value]) =>
        (key === "$type" && value === "string") ||
        (key === "$exists" && value === true) ||
        (["$gt", "$gte"].includes(key) && value === ""),
    )
  );
}
function ensureEmailIndex(Model) {
  if (!initialized.has(Model)) {
    const pending = (async () => {
      if (Model.collection.indexes) {
        const indexes = await Model.collection.indexes().catch((error) => {
          if (error.code === 26) return [];
          throw error;
        });
        const existing = indexes.find(coversEmail);
        if (existing) return existing.name;
      }
      return Model.collection.createIndex({ email: 1 }, EMAIL_INDEX_OPTIONS);
    })().catch(() => {
      initialized.delete(Model);
      throw Object.assign(
        new Error(
          "No se pudo comprobar la unicidad de suscriptores. La administración debe revisar los índices antes de continuar.",
        ),
        { code: "NEWSLETTER_INDEX_UNAVAILABLE", statusCode: 503 },
      );
    });
    initialized.set(Model, pending);
  }
  return initialized.get(Model);
}
module.exports = { EMAIL_INDEX_OPTIONS, ensureEmailIndex, coversEmail };
