const CONTACT_SLUG = "contacto";
async function ensureContactPage(Page) {
  // Existing authored pages keep their identity, blocks and configuration.
  if (await Page.findOne({ slug: CONTACT_SLUG })) return;
  try {
    await Page.findOneAndUpdate(
      { slug: CONTACT_SLUG },
      {
        $setOnInsert: {
          name: "Contacto",
          slug: CONTACT_SLUG,
          pageType: "information",
          systemRole: "contact",
          enabled: true,
          useHeader: true,
          useFooter: true,
          blocks: [],
          informationPageConfig: {},
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code !== 11000 || !(await Page.findOne({ slug: CONTACT_SLUG })))
      throw error;
  }
}
module.exports = { CONTACT_SLUG, ensureContactPage };
