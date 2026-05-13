// backend/models/Country.js
const mongoose = require('mongoose');

const CountrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true }, 
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

CountrySchema.index({ name: 1 });

module.exports = mongoose.model('Country', CountrySchema);
