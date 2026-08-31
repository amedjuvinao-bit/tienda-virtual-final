'use strict';

const CUSTOMER_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ customerCode: 1 }),
    options: Object.freeze({
      name: 'customerCode_1',
      unique: true,
      sparse: true,
    }),
  }),
  Object.freeze({
    key: Object.freeze({ normalizedEmail: 1, deletedAt: 1 }),
    options: Object.freeze({
      name: 'customer_email_identity_unique',
      unique: true,
      partialFilterExpression: Object.freeze({
        normalizedEmail: Object.freeze({ $gt: '' }),
        deletedAt: null,
      }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ normalizedPhone: 1, deletedAt: 1 }),
    options: Object.freeze({
      name: 'customer_phone_identity_unique',
      unique: true,
      partialFilterExpression: Object.freeze({
        normalizedPhone: Object.freeze({ $gt: '' }),
        deletedAt: null,
      }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({
      documentType: 1,
      normalizedDocument: 1,
      deletedAt: 1,
    }),
    options: Object.freeze({
      name: 'customer_document_identity_unique',
      unique: true,
      partialFilterExpression: Object.freeze({
        normalizedDocument: Object.freeze({ $gt: '' }),
        deletedAt: null,
      }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ branchIds: 1, status: 1, deletedAt: 1, updatedAt: -1 }),
    options: Object.freeze({ name: 'customer_branch_status_recent' }),
  }),
  Object.freeze({
    key: Object.freeze({ defaultBranch: 1, status: 1, deletedAt: 1, updatedAt: -1 }),
    options: Object.freeze({ name: 'customer_default_branch_status_recent' }),
  }),
  Object.freeze({
    key: Object.freeze({ source: 1, status: 1, deletedAt: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'customer_source_status_recent' }),
  }),
  Object.freeze({
    key: Object.freeze({ active: 1, deletedAt: 1, createdAt: -1 }),
    options: Object.freeze({
      name: 'active_1_deletedAt_1_createdAt_-1',
    }),
  }),
  Object.freeze({
    key: Object.freeze({
      fullName: 'text',
      phone: 'text',
      email: 'text',
      documentNumber: 'text',
      customerCode: 'text',
    }),
    options: Object.freeze({
      name: 'fullName_text_phone_text_email_text_documentNumber_text_customerCode_text',
    }),
  }),
]);

const CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ customer: 1, deletedAt: 1, createdAt: -1 }),
    options: Object.freeze({
      name: 'customer_1_deletedAt_1_createdAt_-1',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ customer: 1, status: 1, deletedAt: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'customer_follow_up_customer_status_recent' }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, status: 1, deletedAt: 1, dueAt: 1 }),
    options: Object.freeze({ name: 'customer_follow_up_branch_due' }),
  }),
  Object.freeze({
    key: Object.freeze({ assignedToAdmin: 1, status: 1, deletedAt: 1, dueAt: 1 }),
    options: Object.freeze({ name: 'customer_follow_up_assignee_due' }),
  }),
]);

function cloneDefinitions(definitions = []) {
  return definitions.map((definition) => JSON.parse(JSON.stringify(definition)));
}

module.exports = {
  CUSTOMER_FOLLOW_UP_INDEX_DEFINITIONS,
  CUSTOMER_INDEX_DEFINITIONS,
  cloneDefinitions,
};
