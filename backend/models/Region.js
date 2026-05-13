// backend/models/Region.js
const mongoose = require('mongoose');

const RegionSchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, uppercase: true, index: true }, // ej: CO
    code:       { type: String, required: true, uppercase: true, trim: true },   // ej: ANT
    isoCode:    { type: String, trim: true },                                     // ej: CO-ANT
    name:       { type: String, required: true, trim: true },                     // ej: Antioquia
  },
  { timestamps: true }
);

RegionSchema.index({ countryCode: 1, code: 1 }, { unique: true });
RegionSchema.index({ countryCode: 1, name: 1 });

module.exports = mongoose.model('Region', RegionSchema);
