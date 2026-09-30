'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');

const MAGIC = Buffer.from('TVMEDIA1');

function extractedName(meta) {
  if (!meta.name.startsWith('cloudinary/')) return meta.name;
  // Cloudinary's asset ID is stable, while format makes recovered originals
  // directly usable by the operating system. Keep the archive name unchanged.
  const format = typeof meta.format === 'string' ? meta.format.toLowerCase() : '';
  return /^[a-z0-9]{1,12}$/.test(format) ? `${meta.name}.${format}` : meta.name;
}

function safeName(name) {
  return typeof name === 'string' && name.length > 0 && name.length < 1024 &&
    !name.includes('\\') && !name.includes('\0') && !name.split('/').some((part) => !part || part === '.' || part === '..') &&
    !path.posix.isAbsolute(name);
}

async function localFiles(root) {
  const result = [];
  async function visit(directory, relative = '') {
    for (const item of await fs.promises.readdir(directory, { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (!safeName(name) || item.isSymbolicLink()) throw new Error('Hay una ruta no segura en uploads.');
      if (item.isDirectory()) await visit(path.join(directory, item.name), name);
      else if (item.isFile()) {
        const file = path.join(directory, item.name);
        const stat = await fs.promises.lstat(file);
        result.push({ name: `uploads/${name}`, file, size: stat.size, modifiedMs: stat.mtimeMs });
      } else throw new Error('Hay un archivo no regular en uploads.');
    }
  }
  try { await visit(root); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function cloudinaryUrl(asset, cloudName) {
  const url = new URL(asset.secure_url);
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.port ||
      !['image', 'video', 'raw'].includes(asset.resource_type) || asset.type !== 'upload' ||
      !url.pathname.startsWith(`/${encodeURIComponent(cloudName)}/${asset.resource_type}/upload/`) ||
      url.search || url.hash) throw new Error('Cloudinary devolvió una URL de origen no permitida.');
  return url;
}

async function cloudinaryFiles(api, cloudName) {
  const result = [];
  const names = new Set();
  for (const resourceType of ['image', 'video', 'raw']) {
    let cursor;
    const seen = new Set();
    do {
      let page;
      try {
        page = await api.resources({ resource_type: resourceType, type: 'upload', max_results: 500,
          ...(cursor ? { next_cursor: cursor } : {}) });
      } catch (error) {
        const status = Number(error?.http_code || error?.statusCode);
        throw new Error(`No se pudo inventariar Cloudinary${status >= 400 && status < 600 ? ` (HTTP ${status})` : ''}.`);
      }
      if (!Array.isArray(page.resources)) throw new Error('Cloudinary no devolvió un inventario válido.');
      for (const asset of page.resources) {
        if (!asset.asset_id || !asset.public_id || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0) {
          throw new Error('Cloudinary devolvió un recurso incompleto.');
        }
        const url = cloudinaryUrl(asset, cloudName);
        const name = `cloudinary/${resourceType}/${asset.asset_id}`;
        if (!safeName(name) || names.has(name)) throw new Error('Cloudinary devolvió un recurso duplicado.');
        names.add(name);
        result.push({ name, url: url.href, size: asset.bytes, publicId: asset.public_id,
          assetId: asset.asset_id, resourceType, deliveryType: asset.type,
          format: asset.format || null, version: asset.version || null });
      }
      cursor = page.next_cursor;
      if (cursor && (typeof cursor !== 'string' || seen.has(cursor))) throw new Error('Paginación inválida de Cloudinary.');
      if (cursor) seen.add(cursor);
    } while (cursor);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function writeAll(handle, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const result = await handle.write(bytes, offset, bytes.length - offset);
    if (!result.bytesWritten) throw new Error('No se pudo escribir la copia de archivos.');
    offset += result.bytesWritten;
  }
}

async function* source(entry, fetchImpl) {
  if (entry.file) {
    const stat = await fs.promises.lstat(entry.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.size || stat.mtimeMs !== entry.modifiedMs) {
      throw new Error('Cambió un archivo local durante la copia.');
    }
    yield* fs.createReadStream(entry.file);
  } else {
    const response = await fetchImpl(entry.url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`No se pudo descargar un original de Cloudinary (HTTP ${response.status}).`);
    yield* Readable.fromWeb(response.body);
  }
}

async function createBundle(target, files, fetchImpl = fetch) {
  const handle = await fs.promises.open(target, 'wx', 0o600);
  const inventory = [];
  try {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(files.length);
    await writeAll(handle, Buffer.concat([MAGIC, count]));
    for (const entry of files) {
      if (!safeName(entry.name) || !Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error('Entrada inválida de respaldo.');
      const meta = { name: entry.name, size: entry.size,
        ...(entry.publicId ? { publicId: entry.publicId, assetId: entry.assetId,
          resourceType: entry.resourceType, deliveryType: entry.deliveryType,
          format: entry.format, version: entry.version } : {}) };
      const bytes = Buffer.from(JSON.stringify(meta));
      if (bytes.length > 65536) throw new Error('Metadatos de archivo demasiado grandes.');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(bytes.length);
      await writeAll(handle, length);
      await writeAll(handle, bytes);
      const hash = crypto.createHash('sha256');
      let copied = 0;
      for await (const chunk of source(entry, fetchImpl)) {
        copied += chunk.length;
        if (copied > entry.size) throw new Error('El original cambió de tamaño durante la copia.');
        hash.update(chunk);
        await writeAll(handle, chunk);
      }
      if (copied !== entry.size) throw new Error('El original está incompleto.');
      inventory.push({ ...meta, sha256: hash.digest('hex') });
    }
    await handle.sync();
    return inventory;
  } finally { await handle.close(); }
}

async function extractBundle(bundle, destination, expected) {
  const file = await fs.promises.open(bundle, 'r');
  let offset = 0;
  const inventory = [];
  async function read(size) {
    const bytes = Buffer.alloc(size);
    let readCount = 0;
    while (readCount < size) {
      const result = await file.read(bytes, readCount, size - readCount, offset);
      if (!result.bytesRead) throw new Error('Copia de archivos incompleta.');
      offset += result.bytesRead;
      readCount += result.bytesRead;
    }
    return bytes;
  }
  try {
    if (!(await read(8)).equals(MAGIC)) throw new Error('Formato de copia de archivos inválido.');
    const count = (await read(4)).readUInt32BE();
    if (count !== expected.length) throw new Error('El inventario no coincide con la copia.');
    for (let index = 0; index < count; index += 1) {
      const size = (await read(4)).readUInt32BE();
      if (size > 65536) throw new Error('Metadatos inválidos.');
      const meta = JSON.parse((await read(size)).toString('utf8'));
      if (!safeName(meta.name) || !Number.isSafeInteger(meta.size) || meta.size < 0 ||
          JSON.stringify(meta) !== JSON.stringify((({ sha256, ...rest }) => rest)(expected[index]))) {
        throw new Error('Una entrada no coincide con el registro.');
      }
      const output = path.join(destination, ...extractedName(meta).split('/'));
      await fs.promises.mkdir(path.dirname(output), { recursive: true });
      const handle = await fs.promises.open(output, 'wx', 0o600);
      const hash = crypto.createHash('sha256');
      try {
        let remaining = meta.size;
        while (remaining) {
          const bytes = await read(Math.min(remaining, 65536));
          await writeAll(handle, bytes);
          hash.update(bytes);
          remaining -= bytes.length;
        }
      } finally { await handle.close(); }
      const sha256 = hash.digest('hex');
      if (sha256 !== expected[index].sha256) throw new Error('Un archivo no coincide con su huella SHA-256.');
      inventory.push({ ...meta, sha256 });
    }
    if (offset !== (await file.stat()).size) throw new Error('La copia contiene datos adicionales no verificados.');
    return inventory;
  } finally { await file.close(); }
}

module.exports = { localFiles, cloudinaryFiles, createBundle, extractBundle };
