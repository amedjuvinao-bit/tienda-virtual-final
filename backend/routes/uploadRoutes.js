// backend/routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const router = express.Router();

// ⚙️ Config Cloudinary desde .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔐 Chequeo rápido de credenciales (sin exponer secrets)
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error('❌ Faltan variables CLOUDINARY_* en .env');
}

// ✅ IMPORTANTE: resource_type: "auto" para permitir imágenes y videos
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'tienda_virtual',
      resource_type: 'auto', // 👈 permite image y video
      allowed_formats: [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'mp4',
        'webm',
        'ogg'
      ],
      transformation:
        file.mimetype.startsWith('image/')
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
    };
  },
});

// ✅ Ahora aceptamos cualquier field (image o video)
const upload = multer({ storage });

/**
 * Helper para envolver multer y capturar errores con respuesta JSON clara
 */
function runMulter(mw) {
  return (req, res) =>
    mw(req, res, (err) => {
      if (err) {
        console.error('❌ Multer/Cloudinary error:', err);
        const msg = err?.message || 'Fallo al subir archivo';
        return res.status(400).json({ error: msg });
      }
      res.locals.multerOk = true;
      return res.locals.nextHandler ? res.locals.nextHandler() : null;
    });
}

/**
 * POST /api/uploads
 * Campo: image o video (ahora admite ambos)
 * Respuesta: { url }
 */
router.post('/', (req, res) => {
  res.locals.nextHandler = () => {
    try {
      const file = req.files?.[0];
      if (!file?.path) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }
      return res.status(201).json({ url: file.path });
    } catch (e) {
      console.error('❌ Error upload single final:', e);
      return res.status(500).json({ error: e?.message || 'Error interno' });
    }
  };

  return runMulter(upload.any())(req, res); // 👈 acepta image o video
});

/**
 * POST /api/uploads/many
 * Campo: images o files (hasta 5 archivos)
 * Respuesta: { urls: [...] }
 */
router.post('/many', (req, res) => {
  res.locals.nextHandler = () => {
    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ error: 'No se subieron archivos' });
      }
      const urls = files.map((f) => f.path);
      return res.status(201).json({ urls });
    } catch (e) {
      console.error('❌ Error upload many final:', e);
      return res.status(500).json({ error: e?.message || 'Error interno' });
    }
  };

  return runMulter(upload.array('files', 5))(req, res);
});

module.exports = router;
