'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveMongoTool(name, { platform = process.platform, environment = process.env, exists = fs.existsSync } = {}) {
  if (!['mongodump', 'mongorestore'].includes(name)) throw new Error('Herramienta MongoDB no permitida.');
  if (platform !== 'win32') return name;

  const roots = [environment.ProgramFiles, environment.ProgramW6432, 'C:\\Program Files', environment['ProgramFiles(x86)']];
  for (const root of roots.filter(Boolean)) {
    const executable = path.win32.join(root, 'MongoDB', 'Tools', '100', 'bin', `${name}.exe`);
    if (exists(executable)) return executable;
  }
  return name;
}

module.exports = { resolveMongoTool };
