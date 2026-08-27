'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

function readJavaScriptTree(relativeDirectory) {
  const directory = path.join(BACKEND_ROOT, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return [readJavaScriptTree(relativePath)];
      if (!entry.isFile() || !entry.name.endsWith('.js')) return [];
      return [fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8')];
    })
    .join('\n');
}

function readFacade(relativePath) {
  return fs.readFileSync(path.join(BACKEND_ROOT, relativePath), 'utf8');
}

function readWompiWebhookApprovedComposition() {
  return [
    readFacade('services/wompiWebhookApprovedProcessor.js'),
    readJavaScriptTree('services/wompiWebhookApproved'),
  ].join('\n');
}

function readWompiWebhookOrderComposition() {
  return [
    readFacade('services/wompiWebhookOrderService.js'),
    readJavaScriptTree('services/wompiWebhookOrder'),
  ].join('\n');
}

module.exports = {
  readWompiWebhookApprovedComposition,
  readWompiWebhookOrderComposition,
};
