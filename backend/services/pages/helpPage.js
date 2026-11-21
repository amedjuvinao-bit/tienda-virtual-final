const HELP_SLUG = "preguntas-frecuentes";
async function ensureHelpPage(Page) {
  if (await Page.findOne({ slug: HELP_SLUG })) return;
  try {
    await Page.findOneAndUpdate(
      { slug: HELP_SLUG },
      {
        $setOnInsert: {
          name: "Centro de ayuda",
          slug: HELP_SLUG,
          pageType: "information",
          systemRole: "help",
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
    if (error.code !== 11000 || !(await Page.findOne({ slug: HELP_SLUG })))
      throw error;
  }
}
module.exports = { HELP_SLUG, ensureHelpPage };
