// The compound keys coexist with the existing single-field lookup indexes.
// Only undeleted branches selected for a role participate in uniqueness.
const branchSelectionIndexes = [
  {
    key: { isMain: 1, deletedAt: 1 },
    options: {
      name: 'branches_one_main_v1',
      unique: true,
      partialFilterExpression: { isMain: true, deletedAt: null },
    },
  },
  {
    key: { isDefaultForOnlineOrders: 1, deletedAt: 1 },
    options: {
      name: 'branches_one_online_default_v1',
      unique: true,
      partialFilterExpression: { isDefaultForOnlineOrders: true, deletedAt: null },
    },
  },
];

module.exports = branchSelectionIndexes;
