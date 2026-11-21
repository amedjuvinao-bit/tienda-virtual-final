const ABOUT_SLUG = "nosotros";
async function ensureAboutPage(Page) {
  // An existing page belongs to its author; never convert it or replace blocks.
  if (await Page.findOne({ slug: ABOUT_SLUG })) return;
  try {
    await Page.findOneAndUpdate(
      { slug: ABOUT_SLUG },
      {
        $setOnInsert: {
          name: "Nosotros",
          slug: ABOUT_SLUG,
          pageType: "information",
          systemRole: "about",
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
    if (error.code !== 11000 || !(await Page.findOne({ slug: ABOUT_SLUG })))
      throw error;
  }
}
module.exports = { ABOUT_SLUG, ensureAboutPage };
