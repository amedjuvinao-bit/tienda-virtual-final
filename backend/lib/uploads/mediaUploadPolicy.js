'use strict';

const MEDIA_UPLOAD_LIMITS = Object.freeze({ fileSize: 50 * 1024 * 1024, files: 5, fields: 10, parts: 15 });
const MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg', 'audio/ogg']);

function mediaUploadOptions(storage, multer) {
  return {
    storage,
    limits: { ...MEDIA_UPLOAD_LIMITS },
    fileFilter: (_req, file, callback) => {
      const allowed = MEDIA_MIME_TYPES.has(file.mimetype);
      callback(allowed ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname), allowed);
    },
  };
}

module.exports = { MEDIA_UPLOAD_LIMITS, mediaUploadOptions };
