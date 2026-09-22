// backend/routes/uploadRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const {
  CloudinaryMulterStorage,
} = require('../lib/uploads/cloudinaryMulterStorage');
const { env } = require('../config/env');
const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const router = express.Router();
const ADMIN_PANEL_BACKGROUND_PROFILE = 'admin-panel-background';
const ADMIN_PANEL_BACKGROUND_MAX_BYTES = 8 * 1024 * 1024;

function isAdminPanelBackgroundRequest(req) {
  return req.query?.profile === ADMIN_PANEL_BACKGROUND_PROFILE;
}

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
    const adminPanelBackground =
      isAdminPanelBackgroundRequest(req) && file.mimetype.startsWith('image/');
    const preserveLoginBackground =
      req.query?.profile === 'login-background' && file.mimetype.startsWith('image/');

    if (adminPanelBackground) {
      return {
        folder: `${env.cloudinary.folder || 'tienda_virtual'}/admin_panel_backgrounds`,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 2560, height: 1440, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      };
    }

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
        file.mimetype.startsWith('image/') && !preserveLoginBackground
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
    };
  },
});

const upload = multer({ storage });
const uploadAdminPanelBackground = multer({
  storage,
  limits: { fileSize: ADMIN_PANEL_BACKGROUND_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    callback(
      allowed ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image'),
      allowed
    );
  },
});

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

function requireAdminPanelBackgroundAccess(req, res, next) {
  if (!isAdminPanelBackgroundRequest(req)) return next();

  return requireAdmin(req, res, () =>
    requirePermission('settings:panel')(req, res, next)
  );
}

function runMulter(mw) {
  return (req, res) =>
    mw(req, res, (err) => {
      if (err) {
        console.error('Multer/Cloudinary error:', err);
        const msg =
          err?.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen supera el máximo permitido de 8 MB.'
            : err?.code === 'LIMIT_UNEXPECTED_FILE'
              ? 'Solo se permiten imágenes JPG, PNG o WebP.'
              : err?.message || 'Fallo al subir archivo';
        return res.status(400).json({ ok: false, error: msg });
      }
      res.locals.multerOk = true;
      return res.locals.nextHandler ? res.locals.nextHandler() : null;
    });
}

router.post('/', requireAdminPanelBackgroundAccess, requireCloudinary, (req, res) => {
  res.locals.nextHandler = () => {
    try {
      const file = req.file || req.files?.[0];
      if (!file?.path) {
        return res.status(400).json({ ok: false, error: 'No se subio ningun archivo' });
      }
      return res.status(201).json({
        ok: true,
        url: file.path,
        width: file.width || null,
        height: file.height || null,
        bytes: file.size || null,
      });
    } catch (e) {
      console.error('Error upload single final:', e);
      return res.status(500).json({ ok: false, error: e?.message || 'Error interno' });
    }
  };

  const middleware = isAdminPanelBackgroundRequest(req)
    ? uploadAdminPanelBackground.single('image')
    : upload.any();

  return runMulter(middleware)(req, res);
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
