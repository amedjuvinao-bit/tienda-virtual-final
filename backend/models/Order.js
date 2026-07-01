// backend/models/Order.js
const mongoose = require('mongoose');

module.exports = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { timestamps: true }));
