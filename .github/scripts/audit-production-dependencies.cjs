'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const HIGH_SEVERITIES = new Set(['high', 'critical']);
const ALLOWED_ADVISORIES = {
  frontend: new Map([
    [
      'https://github.com/advisories/GHSA-qwww-vcr4-c8h2',
      {
        packages: new Set(['react-router', 'react-router-dom']),
        reason:
          'La tienda usa React Router como SPA y no habilita React Server Components ni Server Actions.',
      },
    ],
  ]),
};

function fail(message) {
  console.error(`ERROR ${message}`);
  process.exit(1);
}

function collectAdvisories(vulnerabilityName, vulnerabilities, visited = new Set()) {
  if (visited.has(vulnerabilityName)) return [];
  visited.add(vulnerabilityName);

  const vulnerability = vulnerabilities[vulnerabilityName];
  if (!vulnerability) return [];

  return (vulnerability.via || []).flatMap((entry) => {
    if (typeof entry === 'string') {
      return collectAdvisories(entry, vulnerabilities, visited);
    }
    return entry?.url ? [entry] : [];
  });
}

function findRscUsage(directory) {
  if (!fs.existsSync(directory)) return [];

  const forbiddenPattern =
    /\b(unstable_[A-Za-z0-9_]*RSC|RSCHydratedRouter|RSCStaticRouter|createFromReadableStream|react-server-dom|ServerRouter|ServerAction)\b/;
  const matches = [];

  function visit(currentPath) {
    const stat = fs.statSync(currentPath);

    if (stat.isDirectory()) {
      fs.readdirSync(currentPath).forEach((name) => {
        if (name !== 'node_modules' && name !== 'dist') {
          visit(path.join(currentPath, name));
        }
      });
      return;
    }

    if (!/\.(cjs|js|jsx|json|mjs|ts|tsx)$/.test(currentPath)) return;

    const content = fs.readFileSync(currentPath, 'utf8');
    if (forbiddenPattern.test(content)) {
      matches.push(path.relative(process.cwd(), currentPath));
    }
  }

  visit(directory);
  return matches;
}

const project = String(process.argv[2] || '').trim();
if (!project) {
  fail('Debes indicar el directorio del proyecto que se va a auditar.');
}

const projectPath = path.resolve(process.cwd(), project);
const audit = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['audit', '--omit=dev', '--json'],
  {
    cwd: projectPath,
    encoding: 'utf8',
    env: process.env,
  }
);

if (audit.error) {
  fail(`No se pudo ejecutar npm audit para ${project}: ${audit.error.message}`);
}

let report;
try {
  report = JSON.parse(audit.stdout || '');
} catch {
  if (audit.stderr) console.error(audit.stderr.trim());
  fail(`npm audit no devolvió un informe JSON válido para ${project}.`);
}

if (report.error) {
  fail(`npm audit falló para ${project}: ${report.error.summary || report.error.message}`);
}

const vulnerabilities = report.vulnerabilities || {};
const allowed = ALLOWED_ADVISORIES[project] || new Map();
const blocked = [];
const accepted = [];

Object.entries(vulnerabilities).forEach(([name, vulnerability]) => {
  if (!HIGH_SEVERITIES.has(vulnerability.severity)) return;

  const advisories = collectAdvisories(name, vulnerabilities);
  const exceptions = advisories
    .map((advisory) => ({
      advisory,
      exception: allowed.get(advisory.url),
    }))
    .filter(
      ({ exception }) =>
        exception && exception.packages.has(name)
    );

  if (
    advisories.length > 0 &&
    exceptions.length === advisories.length
  ) {
    accepted.push({
      name,
      severity: vulnerability.severity,
      exceptions,
    });
    return;
  }

  blocked.push({
    name,
    severity: vulnerability.severity,
    advisories,
  });
});

accepted.forEach(({ name, severity, exceptions }) => {
  const unique = new Map(
    exceptions.map(({ advisory, exception }) => [
      advisory.url,
      { advisory, exception },
    ])
  );

  unique.forEach(({ advisory, exception }) => {
    console.warn(
      `EXCEPCION ${severity.toUpperCase()} ${name}: ${advisory.title} (${advisory.url})`
    );
    console.warn(`          ${exception.reason}`);
  });
});

if (project === 'frontend' && accepted.length > 0) {
  const rscUsage = [
    ...findRscUsage(path.join(projectPath, 'src')),
    ...findRscUsage(path.join(projectPath, 'package.json')),
  ];

  if (rscUsage.length > 0) {
    rscUsage.forEach((file) => {
      console.error(`BLOQUEO RSC detectado en ${file}`);
    });
    fail(
      'La excepción de React Router dejó de ser válida porque el frontend contiene APIs RSC o Server Actions.'
    );
  }

  console.log('OK frontend: no usa APIs RSC ni Server Actions.');
}

if (blocked.length > 0) {
  blocked.forEach(({ name, severity, advisories }) => {
    console.error(`BLOQUEO ${severity.toUpperCase()} ${name}`);
    advisories.forEach((advisory) => {
      console.error(`        ${advisory.title} (${advisory.url})`);
    });
  });
  fail(
    `${project} contiene ${blocked.length} dependencia(s) de producción con vulnerabilidades altas o críticas no autorizadas.`
  );
}

const metadata = report.metadata?.vulnerabilities || {};
console.log(
  `OK ${project}: sin vulnerabilidades altas o críticas alcanzables fuera de las excepciones documentadas.`
);
console.log(
  `   Auditoría npm -> low: ${metadata.low || 0}, moderate: ${metadata.moderate || 0}, high: ${metadata.high || 0}, critical: ${metadata.critical || 0}`
);
