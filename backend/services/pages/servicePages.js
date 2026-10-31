const SERVICE_PAGES = [
  {
    slug: "devoluciones",
    pageType: "returns-page",
    name: "Cambios y devoluciones",
    configKey: "returnsPageConfig",
  },
  {
    slug: "buscar",
    pageType: "search-page",
    name: "Búsqueda",
    configKey: "searchPageConfig",
  },
];
async function ensureServicePages(Page) {
  for (const definition of SERVICE_PAGES) {
    const existing = await Page.findOne({ slug: definition.slug });
    if (existing) {
      if (existing.pageType !== definition.pageType) {
        await Page.findOneAndUpdate(
          { slug: definition.slug },
          { $set: { pageType: definition.pageType } },
        );
      }
      continue;
    }
    try {
      // The unique slug and atomic upsert converge concurrent first reads.
      await Page.findOneAndUpdate(
        { slug: definition.slug },
        {
          $setOnInsert: {
            name: definition.name,
            pageType: definition.pageType,
            enabled: true,
            useHeader: true,
            useFooter: true,
            blocks: [],
            [definition.configKey]: {},
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (
        error.code !== 11000 ||
        !(await Page.findOne({ slug: definition.slug }))
      )
        throw error;
    }
  }
}
module.exports = { SERVICE_PAGES, ensureServicePages };
