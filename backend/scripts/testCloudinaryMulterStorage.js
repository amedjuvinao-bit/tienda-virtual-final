const { PassThrough } = require('stream');

const {
  CloudinaryMulterStorage,
} = require('../lib/uploads/cloudinaryMulterStorage');

let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function ok(message) {
  passed += 1;
  console.log(`OK ${message}`);
}

function handleFile(storage, req, file) {
  return new Promise((resolve, reject) => {
    storage._handleFile(req, file, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function removeFile(storage, req, file) {
  return new Promise((resolve, reject) => {
    storage._removeFile(req, file, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

async function main() {
  const calls = {
    upload: [],
    destroy: [],
  };

  const cloudinary = {
    uploader: {
      upload_stream(options, callback) {
        calls.upload.push(options);
        const stream = new PassThrough();
        let bytes = 0;
        stream.on('data', (chunk) => {
          bytes += chunk.length;
        });
        stream.on('finish', () => {
          callback(null, {
            secure_url: 'https://res.cloudinary.com/demo/image/upload/producto.webp',
            bytes,
            public_id: 'tienda_virtual/producto',
            resource_type: 'image',
          });
        });
        return stream;
      },
      destroy(publicId, options, callback) {
        calls.destroy.push({ publicId, options });
        callback(null, { result: 'ok' });
      },
    },
  };

  const storage = new CloudinaryMulterStorage({
    cloudinary,
    params: async (req, file) => ({
      folder: req.folder,
      resource_type: 'auto',
      transformation: file.mimetype.startsWith('image/')
        ? [{ quality: 'auto' }]
        : undefined,
    }),
  });

  const file = {
    mimetype: 'image/webp',
    stream: new PassThrough(),
  };
  const uploadPromise = handleFile(
    storage,
    { folder: 'tienda_virtual' },
    file
  );
  file.stream.end(Buffer.from('archivo-seguro'));
  const uploaded = await uploadPromise;

  assert(calls.upload.length === 1, 'La subida no se ejecutó exactamente una vez.');
  assert(
    calls.upload[0].folder === 'tienda_virtual' &&
      calls.upload[0].resource_type === 'auto',
    'No se conservaron las opciones dinámicas de Cloudinary.'
  );
  assert(
    uploaded.path.endsWith('/producto.webp') &&
      uploaded.filename === 'tienda_virtual/producto' &&
      uploaded.resourceType === 'image' &&
      uploaded.size === Buffer.byteLength('archivo-seguro'),
    'Multer no recibió los datos esperados de la subida.'
  );
  ok('Subida por stream conserva opciones y metadatos');

  await removeFile(storage, {}, uploaded);
  assert(
    calls.destroy.length === 1 &&
      calls.destroy[0].publicId === 'tienda_virtual/producto' &&
      calls.destroy[0].options.invalidate === true &&
      calls.destroy[0].options.resource_type === 'image',
    'La eliminación no usó el identificador y tipo de recurso correctos.'
  );
  ok('Eliminación conserva public_id, invalidación y tipo de recurso');

  console.log(`\nResultado: ${passed}/2 pruebas aprobadas.`);
}

main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
