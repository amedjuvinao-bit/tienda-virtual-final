"use strict";

const crypto = require("node:crypto");
const { sellerSource } = require("./consumer/sources");
const { normalizePrivacyConfig } = require("./consumer/policies");
const { privacyDocument } = require("./consumer/privacyDocument");
const { buildPublicProductFilter, serializePublicReviews } = require("../lib/products/productPublicView");
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function reviewPrivacyPolicy(settings = {}) {
  const seller = sellerSource(settings);
  const privacy = normalizePrivacyConfig(settings.consumerProtection);
  const privacyText = privacyDocument(privacy).body;
  const text = `Autorizo a ${seller.legalName || "la tienda"} a utilizar el nombre que indique, mi calificación y mi comentario para gestionar y publicar esta reseña. Estos datos serán visibles en la página del producto. Esta autorización no incluye novedades ni ofertas por correo. Puedo ejercer mis derechos desde Datos personales.`;
  const contents = { text, seller, privacyText, privacyVersion: digest({ ...privacy, body: privacyText }) };
  return {
    ...contents,
    version: digest({ purpose: "product-review-publication-1", ...contents }),
    policyUrl: "/privacidad",
    ready: Boolean(seller.legalName && seller.nit && seller.notificationAddress &&
      /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(seller.email) && seller.phone &&
      privacy.privacyEffectiveDate && privacy.retention && privacy.processors),
  };
}

function reviewError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

async function addProductReview({ Product, SiteSettings, productKey, body = {}, now = new Date() }) {
  body = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const value = typeof productKey === "string" ? productKey.trim() : "";
  if (!value) throw reviewError("Producto no encontrado", "PRODUCT_NOT_FOUND", 404);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const rating = Number(body.rating);
  if (!name) throw reviewError("El nombre es obligatorio", "REVIEW_NAME_REQUIRED");
  if (!comment) throw reviewError("El comentario es obligatorio", "REVIEW_COMMENT_REQUIRED");
  if (!Number.isFinite(rating) || rating < 1 || rating > 5)
    throw reviewError("La calificación debe estar entre 1 y 5", "REVIEW_RATING_INVALID");
  const policy = reviewPrivacyPolicy(await SiteSettings.findOne().lean() || {});
  if (!policy.ready) throw reviewError("La tienda debe completar su información de privacidad antes de recibir reseñas.", "REVIEW_PRIVACY_UNAVAILABLE", 503);
  if (body.privacyAuthorized !== true) throw reviewError("Lee y autoriza la información antes de publicar tu reseña.", "REVIEW_PRIVACY_REQUIRED");
  if (body.privacyVersion !== policy.version) throw reviewError("La información de privacidad cambió. Revísala y autoriza de nuevo.", "REVIEW_PRIVACY_CHANGED", 409);
  const identity = /^[0-9a-f]{24}$/i.test(value) ? { $or: [{ _id: value }, { slug: value }] } : { slug: value };
  const product = await Product.findOne(buildPublicProductFilter(identity));
  if (!product) throw reviewError("Producto no encontrado", "PRODUCT_NOT_FOUND", 404);
  if (!Array.isArray(product.reviews)) product.reviews = [];
  product.reviews.push({
    name, comment, rating, createdAt: now,
    privacyAuthorization: {
      version: policy.version, text: policy.text,
      privacyVersion: policy.privacyVersion, privacyText: policy.privacyText,
      seller: policy.seller, authorizedAt: now, method: "explicit_choice",
      source: "product_detail_review", purpose: "product_review_publication",
      reviewDigest: digest({ productId: String(product._id), name, comment, rating }),
    },
  });
  await product.save();
  return { message: "Reseña guardada correctamente", privacyRecorded: true, reviews: serializePublicReviews(product.reviews) };
}

module.exports = { reviewPrivacyPolicy, addProductReview };
