function hasExactIndex(schema, expectedKeys, expectedName) {
  return schema.indexes().some(([keys, options]) => {
    const sameKeys =
      Object.keys(keys).length === Object.keys(expectedKeys).length &&
      Object.entries(expectedKeys).every(
        ([field, direction]) => keys[field] === direction
      );

    return (
      sameKeys &&
      (expectedName === undefined || options.name === expectedName)
    );
  });
}

function getNamedIndexKeys(schema, name) {
  return schema
    .indexes()
    .find(([, options]) => options.name === name)?.[0];
}

module.exports = {
  getNamedIndexKeys,
  hasExactIndex,
};
