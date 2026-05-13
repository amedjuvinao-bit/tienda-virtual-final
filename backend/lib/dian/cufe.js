// backend/lib/dian/cufe.js
const crypto = require("crypto");

function cleanString(value) {
  return String(value ?? "").trim();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toFixed(2);
}

function generateCUFE({
  invoiceNumber,
  issueDate,
  issueTime,
  grossAmount,
  taxAmount,
  totalAmount,
  companyNit,
  customerDocument,
  technicalKey,
  environment,
}) {
  const dataString = [
    cleanString(invoiceNumber),
    cleanString(issueDate),
    cleanString(issueTime),
    formatNumber(grossAmount),
    formatNumber(taxAmount),
    formatNumber(totalAmount),
    cleanString(companyNit),
    cleanString(customerDocument),
    cleanString(technicalKey),
    cleanString(environment || "2"),
  ].join("");

  const cufe = crypto
    .createHash("sha384")
    .update(dataString, "utf8")
    .digest("hex");

  return {
    cufe,
    dataString,
  };
}

module.exports = {
  generateCUFE,
};