// backend/config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // ej: 'mi-cloud'
  api_key: process.env.CLOUDINARY_API_KEY,        // ej: '123456789'
  api_secret: process.env.CLOUDINARY_API_SECRET,  // ej: 'abcDEF...'
});

module.exports = cloudinary;
