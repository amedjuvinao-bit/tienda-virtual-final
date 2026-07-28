class CloudinaryMulterStorage {
  constructor({ cloudinary, params = {} } = {}) {
    if (!cloudinary?.uploader?.upload_stream) {
      throw new Error('Se requiere una instancia válida de Cloudinary.');
    }

    this.cloudinary = cloudinary;
    this.params = params;
  }

  async resolveUploadOptions(req, file) {
    if (typeof this.params === 'function') {
      return (await this.params(req, file)) || {};
    }

    const options = {};
    for (const [key, getterOrValue] of Object.entries(this.params || {})) {
      options[key] =
        typeof getterOrValue === 'function'
          ? await getterOrValue(req, file)
          : getterOrValue;
    }
    return options;
  }

  _handleFile(req, file, callback) {
    this.resolveUploadOptions(req, file)
      .then(
        (options) =>
          new Promise((resolve, reject) => {
            const uploadStream = this.cloudinary.uploader.upload_stream(
              options,
              (error, result) => {
                if (error) {
                  reject(error);
                  return;
                }
                resolve(result);
              }
            );

            file.stream.pipe(uploadStream);
          })
      )
      .then((result) => {
        callback(null, {
          path: result.secure_url,
          size: result.bytes,
          filename: result.public_id,
          resourceType: result.resource_type,
        });
      })
      .catch(callback);
  }

  _removeFile(req, file, callback) {
    if (!file?.filename) {
      callback(null);
      return;
    }

    const options = {
      invalidate: true,
    };

    if (file.resourceType) {
      options.resource_type = file.resourceType;
    }

    this.cloudinary.uploader.destroy(file.filename, options, callback);
  }
}

module.exports = {
  CloudinaryMulterStorage,
};
