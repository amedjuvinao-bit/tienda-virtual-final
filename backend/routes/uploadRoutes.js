// backend/routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const {
  CloudinaryMulterStorage,
} = require('../lib/uploads/cloudinaryMulterStorage');
const { env } = require('../config/env');

const router = express.Router();

const cloudinaryReady = Boolean(
  env.cloudinary.cloudName &&
  env.cloudinary.apiKey &&
  env.cloudinary.apiSecret
);

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

if (!cloudinaryReady) {
  console.warn('Cloudinary backend no esta completamente configurado. La subida de archivos respondera 503 hasta configurar CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
}

const storage = new CloudinaryMulterStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: env.cloudinary.folder || 'tienda_virtual',
      resource_type: 'auto',
      allowed_formats: [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'mp4',
        'webm',
        'ogg',
      ],
      transformation:
        file.mimetype.startsWith('image/')
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
    };
  },
});

const upload = multer({ storage });

function requireCloudinary(req, res, next) {
  if (!cloudinaryReady) {
    return res.status(503).json({
      ok: false,
      error: 'Cloudinary no configurado',
      message: 'Faltan credenciales backend de Cloudinary para subir archivos.',
    });
  }

  return next();
}

function runMulter(mw) {
  return (req, res) =>
    mw(req, res, (err) => {
      if (err) {
        console.error('Multer/Cloudinary error:', err);
        const msg = err?.message || 'Fallo al subir archivo';
        return res.status(400).json({ ok: false, error: msg });
      }
      res.locals.multerOk = true;
      return res.locals.nextHandler ? res.locals.nextHandler() : null;
    });
}

router.post('/', requireCloudinary, (req, res) => {
  res.locals.nextHandler = () => {
    try {
      const file = req.files?.[0];
      if (!file?.path) {
        return res.status(400).json({ ok: false, error: 'No se subio ningun archivo' });
      }
      return res.status(201).json({ ok: true, url: file.path });
    } catch (e) {
      console.error('Error upload single final:', e);
      return res.status(500).json({ ok: false, error: e?.message || 'Error interno' });
    }
  };

  return runMulter(upload.any())(req, res);
});

router.post('/many', requireCloudinary, (req, res) => {
  res.locals.nextHandler = () => {
    try {
      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ ok: false, error: 'No se subieron archivos' });
      }
      const urls = files.map((f) => f.path);
      return res.status(201).json({ ok: true, urls });
    } catch (e) {
      console.error('Error upload many final:', e);
      return res.status(500).json({ ok: false, error: e?.message || 'Error interno' });
    }
  };

  return runMulter(upload.array('files', 5))(req, res);
});

module.exports = router;
