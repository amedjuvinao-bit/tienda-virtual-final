const express = require("express");
const mongoose = require("mongoose");
const Page = require("../models/Page");

const router = express.Router();

const SYSTEM_CART_SLUG = "carrito";
const SYSTEM_CHECKOUT_SLUG = "checkout";
const SYSTEM_THANKS_SLUG = "gracias";
const SYSTEM_FAVORITES_SLUG = "favoritos";
const SYSTEM_NOT_FOUND_SLUG = "not-found";

function normalizePageType(value) {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === "catalog") return "catalog";
  if (safe === "product-detail") return "product-detail";
  if (safe === "cart-page") return "cart-page";
  if (safe === "checkout-page") return "checkout-page";
  if (safe === "thanks-page") return "thanks-page";
  if (safe === "favorites-page") return "favorites-page";
  if (safe === "notfound-page") return "notfound-page";
  return "custom";
}

async function ensureSystemCartPage() {
  let cartPage = await Page.findOne({ slug: SYSTEM_CART_SLUG });

  if (!cartPage) {
    cartPage = await Page.create({
      name: "Carrito",
      slug: SYSTEM_CART_SLUG,
      pageType: "cart-page",
      enabled: true,
      useHeader: true,
      useFooter: true,
      blocks: [],
      catalogConfig: {},
      productDetailConfig: {},
      cartPageConfig: {},
      checkoutPageConfig: {},
      thanksPageConfig: {},
      favoritesPageConfig: {},
      notFoundPageConfig: {},
    });
    return cartPage;
  }

  let shouldSave = false;

  if (String(cartPage.pageType || "").toLowerCase() !== "cart-page") {
    cartPage.pageType = "cart-page";
    shouldSave = true;
  }

  if (typeof cartPage.cartPageConfig !== "object" || cartPage.cartPageConfig === null) {
    cartPage.cartPageConfig = {};
    shouldSave = true;
  }

  if (typeof cartPage.checkoutPageConfig !== "object" || cartPage.checkoutPageConfig === null) {
    cartPage.checkoutPageConfig = {};
    shouldSave = true;
  }

  if (typeof cartPage.thanksPageConfig !== "object" || cartPage.thanksPageConfig === null) {
    cartPage.thanksPageConfig = {};
    shouldSave = true;
  }

  if (typeof cartPage.favoritesPageConfig !== "object" || cartPage.favoritesPageConfig === null) {
    cartPage.favoritesPageConfig = {};
    shouldSave = true;
  }

  if (typeof cartPage.notFoundPageConfig !== "object" || cartPage.notFoundPageConfig === null) {
    cartPage.notFoundPageConfig = {};
    shouldSave = true;
  }

  if (shouldSave) {
    await cartPage.save();
  }

  return cartPage;
}

async function ensureSystemCheckoutPage() {
  let checkoutPage = await Page.findOne({ slug: SYSTEM_CHECKOUT_SLUG });

  if (!checkoutPage) {
    checkoutPage = await Page.create({
      name: "Checkout",
      slug: SYSTEM_CHECKOUT_SLUG,
      pageType: "checkout-page",
      enabled: true,
      useHeader: true,
      useFooter: true,
      blocks: [],
      catalogConfig: {},
      productDetailConfig: {},
      cartPageConfig: {},
      checkoutPageConfig: {},
      thanksPageConfig: {},
      favoritesPageConfig: {},
      notFoundPageConfig: {},
    });
    return checkoutPage;
  }

  let shouldSave = false;

  if (String(checkoutPage.pageType || "").toLowerCase() !== "checkout-page") {
    checkoutPage.pageType = "checkout-page";
    shouldSave = true;
  }

  if (
    typeof checkoutPage.checkoutPageConfig !== "object" ||
    checkoutPage.checkoutPageConfig === null
  ) {
    checkoutPage.checkoutPageConfig = {};
    shouldSave = true;
  }

  if (typeof checkoutPage.cartPageConfig !== "object" || checkoutPage.cartPageConfig === null) {
    checkoutPage.cartPageConfig = {};
    shouldSave = true;
  }

  if (typeof checkoutPage.thanksPageConfig !== "object" || checkoutPage.thanksPageConfig === null) {
    checkoutPage.thanksPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof checkoutPage.favoritesPageConfig !== "object" ||
    checkoutPage.favoritesPageConfig === null
  ) {
    checkoutPage.favoritesPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof checkoutPage.notFoundPageConfig !== "object" ||
    checkoutPage.notFoundPageConfig === null
  ) {
    checkoutPage.notFoundPageConfig = {};
    shouldSave = true;
  }

  if (shouldSave) {
    await checkoutPage.save();
  }

  return checkoutPage;
}

async function ensureSystemThanksPage() {
  let thanksPage = await Page.findOne({ slug: SYSTEM_THANKS_SLUG });

  if (!thanksPage) {
    thanksPage = await Page.create({
      name: "Gracias",
      slug: SYSTEM_THANKS_SLUG,
      pageType: "thanks-page",
      enabled: true,
      useHeader: true,
      useFooter: true,
      blocks: [],
      catalogConfig: {},
      productDetailConfig: {},
      cartPageConfig: {},
      checkoutPageConfig: {},
      thanksPageConfig: {},
      favoritesPageConfig: {},
      notFoundPageConfig: {},
    });
    return thanksPage;
  }

  let shouldSave = false;

  if (String(thanksPage.pageType || "").toLowerCase() !== "thanks-page") {
    thanksPage.pageType = "thanks-page";
    shouldSave = true;
  }

  if (
    typeof thanksPage.thanksPageConfig !== "object" ||
    thanksPage.thanksPageConfig === null
  ) {
    thanksPage.thanksPageConfig = {};
    shouldSave = true;
  }

  if (typeof thanksPage.cartPageConfig !== "object" || thanksPage.cartPageConfig === null) {
    thanksPage.cartPageConfig = {};
    shouldSave = true;
  }

  if (typeof thanksPage.checkoutPageConfig !== "object" || thanksPage.checkoutPageConfig === null) {
    thanksPage.checkoutPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof thanksPage.favoritesPageConfig !== "object" ||
    thanksPage.favoritesPageConfig === null
  ) {
    thanksPage.favoritesPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof thanksPage.notFoundPageConfig !== "object" ||
    thanksPage.notFoundPageConfig === null
  ) {
    thanksPage.notFoundPageConfig = {};
    shouldSave = true;
  }

  if (shouldSave) {
    await thanksPage.save();
  }

  return thanksPage;
}

async function ensureSystemFavoritesPage() {
  let favoritesPage = await Page.findOne({ slug: SYSTEM_FAVORITES_SLUG });

  if (!favoritesPage) {
    favoritesPage = await Page.create({
      name: "Favoritos",
      slug: SYSTEM_FAVORITES_SLUG,
      pageType: "favorites-page",
      enabled: true,
      useHeader: true,
      useFooter: true,
      blocks: [],
      catalogConfig: {},
      productDetailConfig: {},
      cartPageConfig: {},
      checkoutPageConfig: {},
      thanksPageConfig: {},
      favoritesPageConfig: {},
      notFoundPageConfig: {},
    });
    return favoritesPage;
  }

  let shouldSave = false;

  if (String(favoritesPage.pageType || "").toLowerCase() !== "favorites-page") {
    favoritesPage.pageType = "favorites-page";
    shouldSave = true;
  }

  if (
    typeof favoritesPage.favoritesPageConfig !== "object" ||
    favoritesPage.favoritesPageConfig === null
  ) {
    favoritesPage.favoritesPageConfig = {};
    shouldSave = true;
  }

  if (typeof favoritesPage.cartPageConfig !== "object" || favoritesPage.cartPageConfig === null) {
    favoritesPage.cartPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof favoritesPage.checkoutPageConfig !== "object" ||
    favoritesPage.checkoutPageConfig === null
  ) {
    favoritesPage.checkoutPageConfig = {};
    shouldSave = true;
  }

  if (typeof favoritesPage.thanksPageConfig !== "object" || favoritesPage.thanksPageConfig === null) {
    favoritesPage.thanksPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof favoritesPage.notFoundPageConfig !== "object" ||
    favoritesPage.notFoundPageConfig === null
  ) {
    favoritesPage.notFoundPageConfig = {};
    shouldSave = true;
  }

  if (shouldSave) {
    await favoritesPage.save();
  }

  return favoritesPage;
}

async function ensureSystemNotFoundPage() {
  let notFoundPage = await Page.findOne({ slug: SYSTEM_NOT_FOUND_SLUG });

  if (!notFoundPage) {
    notFoundPage = await Page.create({
      name: "Not Found",
      slug: SYSTEM_NOT_FOUND_SLUG,
      pageType: "notfound-page",
      enabled: true,
      useHeader: true,
      useFooter: true,
      blocks: [],
      catalogConfig: {},
      productDetailConfig: {},
      cartPageConfig: {},
      checkoutPageConfig: {},
      thanksPageConfig: {},
      favoritesPageConfig: {},
      notFoundPageConfig: {},
    });
    return notFoundPage;
  }

  let shouldSave = false;

  if (String(notFoundPage.pageType || "").toLowerCase() !== "notfound-page") {
    notFoundPage.pageType = "notfound-page";
    shouldSave = true;
  }

  if (
    typeof notFoundPage.notFoundPageConfig !== "object" ||
    notFoundPage.notFoundPageConfig === null
  ) {
    notFoundPage.notFoundPageConfig = {};
    shouldSave = true;
  }

  if (typeof notFoundPage.cartPageConfig !== "object" || notFoundPage.cartPageConfig === null) {
    notFoundPage.cartPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof notFoundPage.checkoutPageConfig !== "object" ||
    notFoundPage.checkoutPageConfig === null
  ) {
    notFoundPage.checkoutPageConfig = {};
    shouldSave = true;
  }

  if (typeof notFoundPage.thanksPageConfig !== "object" || notFoundPage.thanksPageConfig === null) {
    notFoundPage.thanksPageConfig = {};
    shouldSave = true;
  }

  if (
    typeof notFoundPage.favoritesPageConfig !== "object" ||
    notFoundPage.favoritesPageConfig === null
  ) {
    notFoundPage.favoritesPageConfig = {};
    shouldSave = true;
  }

  if (shouldSave) {
    await notFoundPage.save();
  }

  return notFoundPage;
}

// GET /api/pages
router.get("/", async (req, res) => {
  try {
    await ensureSystemCartPage();
    await ensureSystemCheckoutPage();
    await ensureSystemThanksPage();
    await ensureSystemFavoritesPage();
    await ensureSystemNotFoundPage();
    const pages = await Page.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (error) {
    console.error("Error listando páginas:", error);
    res.status(500).json({ message: "Error listando páginas" });
  }
});

// GET /api/pages/:value
router.get("/:value", async (req, res) => {
  try {
    await ensureSystemCartPage();
    await ensureSystemCheckoutPage();
    await ensureSystemThanksPage();
    await ensureSystemFavoritesPage();
    await ensureSystemNotFoundPage();

    const rawValue = String(req.params.value || "").trim();
    const slug = rawValue.toLowerCase();

    let page = await Page.findOne({ slug });

    if (!page && mongoose.Types.ObjectId.isValid(rawValue)) {
      page = await Page.findById(rawValue);
    }

    if (!page) {
      return res.status(404).json({ message: "Página no encontrada" });
    }

    res.json(page);
  } catch (error) {
    console.error("Error obteniendo página:", error);
    res.status(500).json({ message: "Error obteniendo página" });
  }
});

// POST /api/pages
router.post("/", async (req, res) => {
  try {
    const body = req.body || {};

    const name = String(body.name || "").trim();
    const slug = String(body.slug || "").trim().toLowerCase();
    const pageType = normalizePageType(body.pageType);

    if (!name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    if (!slug) {
      return res.status(400).json({ message: "El slug es obligatorio" });
    }

    if (
      slug === SYSTEM_CART_SLUG ||
      pageType === "cart-page" ||
      slug === SYSTEM_CHECKOUT_SLUG ||
      pageType === "checkout-page" ||
      slug === SYSTEM_THANKS_SLUG ||
      pageType === "thanks-page" ||
      slug === SYSTEM_FAVORITES_SLUG ||
      pageType === "favorites-page" ||
      slug === SYSTEM_NOT_FOUND_SLUG ||
      pageType === "notfound-page"
    ) {
      return res.status(400).json({
        message:
          'Las páginas "Carrito", "Checkout", "Gracias", "Favoritos" y "Not Found" son fijas del sistema y no se pueden crear manualmente',
      });
    }

    const exists = await Page.findOne({ slug });
    if (exists) {
      return res.status(400).json({ message: "Ya existe una página con ese slug" });
    }

    const page = await Page.create({
      name,
      slug,
      pageType,
      enabled: body.enabled !== false,
      useHeader: body.useHeader !== false,
      useFooter: body.useFooter !== false,
      blocks: Array.isArray(body.blocks) ? body.blocks : [],
      catalogConfig:
        pageType === "catalog" && typeof body.catalogConfig === "object"
          ? body.catalogConfig
          : {},
      productDetailConfig:
        pageType === "product-detail" && typeof body.productDetailConfig === "object"
          ? body.productDetailConfig
          : {},
      cartPageConfig:
        pageType === "cart-page" && typeof body.cartPageConfig === "object"
          ? body.cartPageConfig
          : {},
      checkoutPageConfig:
        pageType === "checkout-page" && typeof body.checkoutPageConfig === "object"
          ? body.checkoutPageConfig
          : {},
      thanksPageConfig:
        pageType === "thanks-page" && typeof body.thanksPageConfig === "object"
          ? body.thanksPageConfig
          : {},
      favoritesPageConfig:
        pageType === "favorites-page" && typeof body.favoritesPageConfig === "object"
          ? body.favoritesPageConfig
          : {},
      notFoundPageConfig:
        pageType === "notfound-page" && typeof body.notFoundPageConfig === "object"
          ? body.notFoundPageConfig
          : {},
    });

    res.status(201).json(page);
  } catch (error) {
    console.error("Error creando página:", error);
    res.status(500).json({ message: "Error creando página" });
  }
});

// PUT /api/pages/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de página inválido" });
    }

    const existingPage = await Page.findById(id);

    if (!existingPage) {
      return res.status(404).json({ message: "Página no encontrada" });
    }

    const existingIsSystemCart = String(existingPage.slug || "").toLowerCase() === SYSTEM_CART_SLUG;
    const existingIsSystemCheckout =
      String(existingPage.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG;
    const existingIsSystemThanks =
      String(existingPage.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG;
    const existingIsSystemFavorites =
      String(existingPage.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG;
    const existingIsSystemNotFound =
      String(existingPage.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG;

    const requestedPageType = normalizePageType(body.pageType);
    const finalPageType = existingIsSystemCart
      ? "cart-page"
      : existingIsSystemCheckout
      ? "checkout-page"
      : existingIsSystemThanks
      ? "thanks-page"
      : existingIsSystemFavorites
      ? "favorites-page"
      : existingIsSystemNotFound
      ? "notfound-page"
      : requestedPageType;

    const finalSlug = existingIsSystemCart
      ? SYSTEM_CART_SLUG
      : existingIsSystemCheckout
      ? SYSTEM_CHECKOUT_SLUG
      : existingIsSystemThanks
      ? SYSTEM_THANKS_SLUG
      : existingIsSystemFavorites
      ? SYSTEM_FAVORITES_SLUG
      : existingIsSystemNotFound
      ? SYSTEM_NOT_FOUND_SLUG
      : String(body.slug || "").trim().toLowerCase();

    const finalName = existingIsSystemCart
      ? "Carrito"
      : existingIsSystemCheckout
      ? "Checkout"
      : existingIsSystemThanks
      ? "Gracias"
      : existingIsSystemFavorites
      ? "Favoritos"
      : existingIsSystemNotFound
      ? "Not Found"
      : String(body.name || "").trim();

    const dataToUpdate = {
      name: finalName,
      slug: finalSlug,
      pageType: finalPageType,
      enabled: body.enabled !== false,
      useHeader: body.useHeader !== false,
      useFooter: body.useFooter !== false,
      blocks:
        existingIsSystemCart ||
        existingIsSystemCheckout ||
        existingIsSystemThanks ||
        existingIsSystemFavorites ||
        existingIsSystemNotFound
          ? []
          : Array.isArray(body.blocks)
          ? body.blocks
          : [],
      catalogConfig:
        finalPageType === "catalog" && typeof body.catalogConfig === "object"
          ? body.catalogConfig
          : {},
      productDetailConfig:
        finalPageType === "product-detail" && typeof body.productDetailConfig === "object"
          ? body.productDetailConfig
          : {},
      cartPageConfig:
        finalPageType === "cart-page" && typeof body.cartPageConfig === "object"
          ? body.cartPageConfig
          : {},
      checkoutPageConfig:
        finalPageType === "checkout-page" && typeof body.checkoutPageConfig === "object"
          ? body.checkoutPageConfig
          : {},
      thanksPageConfig:
        finalPageType === "thanks-page" && typeof body.thanksPageConfig === "object"
          ? body.thanksPageConfig
          : {},
      favoritesPageConfig:
        finalPageType === "favorites-page" && typeof body.favoritesPageConfig === "object"
          ? body.favoritesPageConfig
          : {},
      notFoundPageConfig:
        finalPageType === "notfound-page" && typeof body.notFoundPageConfig === "object"
          ? body.notFoundPageConfig
          : {},
    };

    if (!dataToUpdate.name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    if (!dataToUpdate.slug) {
      return res.status(400).json({ message: "El slug es obligatorio" });
    }

    const slugInUse = await Page.findOne({
      slug: dataToUpdate.slug,
      _id: { $ne: id },
    });

    if (slugInUse) {
      return res.status(400).json({ message: "Ya existe otra página con ese slug" });
    }

    const updatedPage = await Page.findByIdAndUpdate(id, dataToUpdate, {
      new: true,
      runValidators: true,
    });

    if (!updatedPage) {
      return res.status(404).json({ message: "Página no encontrada" });
    }

    res.json(updatedPage);
  } catch (error) {
    console.error("Error actualizando página:", error);
    res.status(500).json({ message: "Error actualizando página" });
  }
});

// ✅ DELETE /api/pages/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID de página inválido" });
    }

    const page = await Page.findById(id);

    if (!page) {
      return res.status(404).json({ message: "Página no encontrada" });
    }

    if (
      String(page.slug || "").toLowerCase() === SYSTEM_CART_SLUG ||
      String(page.slug || "").toLowerCase() === SYSTEM_CHECKOUT_SLUG ||
      String(page.slug || "").toLowerCase() === SYSTEM_THANKS_SLUG ||
      String(page.slug || "").toLowerCase() === SYSTEM_FAVORITES_SLUG ||
      String(page.slug || "").toLowerCase() === SYSTEM_NOT_FOUND_SLUG
    ) {
      return res.status(400).json({
        message: 'Las páginas "Carrito", "Checkout", "Gracias", "Favoritos" y "Not Found" son fijas del sistema y no se pueden eliminar',
      });
    }

    const deletedPage = await Page.findByIdAndDelete(id);

    res.json({
      message: "Página eliminada correctamente",
      deletedId: deletedPage._id,
    });
  } catch (error) {
    console.error("Error eliminando página:", error);
    res.status(500).json({ message: "Error eliminando página" });
  }
});

module.exports = router;