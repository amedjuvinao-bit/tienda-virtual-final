// backend/models/City.js
const mongoose = require('mongoose');

const CitySchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, uppercase: true, index: true },
    regionCode: { type: String, uppercase: true, index: true },

    code: { type: String, trim: true },
    name: { type: String, required: true, trim: true, index: true },

    departmentCode: { type: String, trim: true },
    department: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('City', CitySchema);