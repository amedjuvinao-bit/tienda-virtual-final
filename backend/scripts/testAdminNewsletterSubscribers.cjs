"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const express = require("express");
const mongoose = require("mongoose");
const Subscriber = require("../models/Subscriber");
const Event = require("../models/NewsletterConsentEvent");
const { createAdminSubscriptionReader } = require("../services/newsletter/adminRead");
const reader = createAdminSubscriptionReader();
const objectId = value => new mongoose.Types.ObjectId(value.toString(16).padStart(24, "0"));
const get = (row, key) => key.split(".").reduce((value, part) => value?.[part], row);
let subscribers, events, calls, failReads;

// Replace only driver reads. Casting, projections and queries use real Mongoose.
// Fixtures are in memory: no MongoDB connection or real contact is accessed.
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") return expected.every(clause => matches(row, clause));
    if (key === "$nor") return !expected.some(clause => matches(row, clause));
    const actual = get(row, key);
    if (expected && expected.constructor === Object) {
      return Object.entries(expected).every(([op, value]) => {
        if (op === "$type") return typeof actual === value;
        if (op === "$gt") return actual > value;
        if (op === "$in") return value.includes(actual);
        if (op === "$regex") return new RegExp(value, filter[key].$options).test(actual);
        if (op === "$options") return true;
        throw new Error(`Unsupported fixture operator: ${op}`);
      });
    }
    return String(actual) === String(expected);
  });
}
const originals = [];
function replace(model, method, fn) {
  originals.push([model.collection, method, model.collection[method]]);
  model.collection[method] = fn;
}
function fixtureReads(model, rows) {
  replace(model, "find", (filter, options) => {
    if (failReads) throw new Error("private database detail");
    calls.push({ model: model.modelName, method: "find", filter, options });
    let result = rows().filter(row => matches(row, filter));
    if (options.sort) result.sort((a, b) => {
      for (const [key, direction] of Object.entries(options.sort)) {
        if (a[key] > b[key]) return direction;
        if (a[key] < b[key]) return -direction;
      }
      return 0;
    });
    result = result.slice(options.skip || 0, (options.skip || 0) + (options.limit || result.length));
    return { toArray: async () => result.map(row => ({ ...row })) };
  });
  replace(model, "countDocuments", async filter => rows().filter(row => matches(row, filter)).length);
}
fixtureReads(Subscriber, () => subscribers);
fixtureReads(Event, () => events);
replace(Subscriber, "findOne", async (filter, options) => {
  if (failReads) throw new Error("private database detail");
  calls.push({ model: "Subscriber", method: "findOne", filter, options });
  return subscribers.find(row => matches(row, filter)) || null;
});

function loadWith(file, replacements) {
  const filename = path.resolve(__dirname, file);
  const module = { exports: {} };
  const localRequire = Module.createRequire(filename);
  const wrapped = new vm.Script(Module.wrap(fs.readFileSync(filename, "utf8")), { filename }).runInThisContext();
  wrapped(module.exports, name => Object.hasOwn(replacements, name) ? replacements[name] : localRequire(name), module, filename, path.dirname(filename));
  return module.exports;
}
const permission = loadWith("../middleware/requirePermission.js", {
  "../models/AdminRole": { findOne() { throw new Error("Unexpected role database read"); } },
});
const router = loadWith("../routes/adminNewsletterSubscribers.js", { "../middleware/requirePermission": permission });
let server, baseUrl;
test.before(async () => {
  const app = express();
  app.use((req, _res, next) => {
    if (req.headers["x-test-role"]) {
      req.adminRole = req.headers["x-test-role"];
      req.adminUserId = String(objectId(99));
      req.adminEffectivePermissionsLoaded = true;
      req.adminEffectivePermissions = (req.headers["x-test-permissions"] || "").split(",");
    }
    next();
  });
  app.use("/subscriptions", router);
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}/subscriptions`;
});
test.after(async () => {
  for (const [collection, method, original] of originals) collection[method] = original;
  await new Promise(resolve => server.close(resolve));
});
test.beforeEach(() => {
  calls = []; failReads = false;
  const consent = { status: "granted", channel: "email", method: "email_code",
    proofReference: "reference-1", version: "v1", text: "Aviso comunicado.",
    recordedAt: new Date("2026-11-03T05:00:00Z") };
  subscribers = [
    { _id: objectId(1), email: "persona+ventas@example.com", status: "granted", consent,
      updatedAt: new Date("2026-11-03T05:00:00Z"), phone: "private-phone",
      sessionId: "private-session", verification: { nonce: "private-nonce", hash: "private-hash" } },
    { _id: objectId(2), email: "retirada@example.com", status: "withdrawn", consent: { ...consent, status: "withdrawn" } },
    { _id: objectId(3), email: "pendiente@example.com", status: "unknown" },
    { _id: objectId(4), email: "legacy@example.com", status: "granted" },
    { _id: objectId(5), phone: "private-phone", status: "unknown" },
  ];
  events = Array.from({ length: 25 }, (_, index) => ({ _id: objectId(index + 100), subscriber: objectId(1),
    createdAt: new Date(Date.UTC(2026, 10, 3, 0, index)), proof: consent }));
  events.push({ _id: objectId(200), subscriber: objectId(2), createdAt: new Date(), proof: { ...consent, status: "withdrawn" } });
});

test("lists standalone subscribers, with no customer lookup and without private fields", async () => {
  const result = await reader.list();
  assert.equal(result.total, 4);
  assert.equal(result.subscribers.find(row => row.email === "legacy@example.com").status, "unknown");
  assert(!JSON.stringify(result).includes("private-"));
  const projection = calls[0].options.projection;
  assert.equal(projection.email, 1);
  assert(!projection.verification && !projection.phone && !projection.sessionId);
});
test("authorization filter requires proof; unconfirmed and legacy contacts remain unconfirmed", async () => {
  assert.equal((await reader.list({ status: "granted" })).total, 1);
  assert.equal((await reader.list({ status: "unknown" })).total, 2);
  const withdrawn = await reader.list({ status: "withdrawn" });
  assert.equal(withdrawn.total, 1);
  assert.equal(withdrawn.subscribers[0].status, "withdrawn");
});
test("email search treats regex characters literally and combines status and pagination", async () => {
  const result = await reader.list({ q: "PERSONA+VENTAS@EXAMPLE.COM", status: "granted", limit: 1 });
  assert.equal(result.total, 1);
  assert.equal(result.subscribers[0].email, "persona+ventas@example.com");
  assert.equal((await reader.list({ q: ".*" })).total, 0);
  const page = await reader.list({ page: 2, limit: 2 });
  assert.equal(page.page, 2);
  assert.equal(page.pages, 2);
  assert.equal(page.subscribers.length, 2);
});
test("invalid searches, states, ids and unbounded pages are rejected before reading", async () => {
  for (const query of [{ q: { $ne: "" } }, { q: "x".repeat(255) }, { status: "other" }, { page: -1 }, { limit: 1000 }]) {
    await assert.rejects(reader.list(query), error => error.statusCode === 400);
  }
  await assert.rejects(reader.detail("bad-id"), error => error.statusCode === 400);
  assert.equal(calls.length, 0);
});
test("detail paginates durable evidence, isolates the contact and never returns verification secrets", async () => {
  const result = await reader.detail(String(objectId(1)), { page: 2 });
  assert.equal(result.events.length, 5);
  assert.equal(result.total, 25);
  assert.equal(result.pages, 2);
  assert.equal(result.subscriber.consent.text, "Aviso comunicado.");
  assert(result.events.every(event => event.proof.status === "granted"));
  assert(!JSON.stringify(result).includes("private-"));
  assert.equal(calls[0].options.projection.consent, 1);
  assert(!calls[0].options.projection.verification);
});
test("unknown ids and contacts without email do not expose other subscriber data", async () => {
  for (const id of [objectId(5), objectId(50)]) {
    await assert.rejects(reader.detail(String(id)), error => error.statusCode === 404);
  }
});
test("HTTP rejects unauthenticated, unauthorized and branch-scoped administrators", async () => {
  assert.equal((await fetch(baseUrl)).status, 401);
  assert.equal((await fetch(baseUrl, { headers: { "x-test-role": "cashier", "x-test-permissions": "customers:view" } })).status, 403);
  const scoped = await fetch(baseUrl, { headers: { "x-test-role": "cashier", "x-test-permissions": "customers:view,customers:audit,customers:sensitive" } });
  assert.equal(scoped.status, 403);
  assert.equal((await scoped.json()).error, "SUBSCRIPTIONS_GLOBAL_ACCESS_REQUIRED");
  assert.equal(calls.length, 0);
});
test("HTTP owner can search and review a withdrawn subscription, with no-store", async () => {
  const headers = { "x-test-role": "owner" };
  const response = await fetch(`${baseUrl}?q=retirada%40example.com`, { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const list = await response.json();
  assert.equal(list.subscribers[0].status, "withdrawn");
  const detail = await (await fetch(`${baseUrl}/${list.subscribers[0].id}`, { headers })).json();
  assert.equal(detail.subscriber.consent.status, "withdrawn");
  assert.equal(detail.events[0].proof.status, "withdrawn");
});
test("HTTP failures return a safe error without presenting an empty successful list", async () => {
  failReads = true;
  const response = await fetch(baseUrl, { headers: { "x-test-role": "owner" } });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.ok, false);
  assert.equal(result.error, "SUBSCRIPTIONS_UNAVAILABLE");
  assert(!JSON.stringify(result).includes("private database"));
});
