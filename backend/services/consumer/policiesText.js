"use strict";
const clean = (value, max = 300) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
module.exports = { clean };
