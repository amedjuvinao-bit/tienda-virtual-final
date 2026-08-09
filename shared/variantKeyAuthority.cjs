'use strict';

const DEFAULT_VARIANT_KEY = 'default__default';
const MAX_VARIANT_KEY_LENGTH = 180;
const COLOR_VALUE_ALIASES = new Map([
  ['negro', 'black'],
  ['blanco', 'white'],
  ['rojo', 'red'],
  ['azul', 'blue'],
  ['amarillo', 'yellow'],
  ['verde', 'green'],
  ['rosado', 'pink'],
  ['fucsia', 'fuchsia'],
  ['rojo intenso', 'crimson'],
  ['salmon', 'salmon'],
  ['celeste', 'skyblue'],
  ['azul rey', 'royalblue'],
  ['azul marino', 'navy'],
  ['verde azulado', 'teal'],
  ['morado', 'purple'],
  ['violeta', 'violet'],
  ['naranja', 'orange'],
  ['gris', 'gray'],
  ['cafe', 'brown'],
  ['beige', 'beige'],
  ['dorado', 'gold'],
  ['plateado', 'silver'],
]);

function toPlain(value) {
  if (!value || typeof value !== 'object') return value;
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true, virtuals: false })
    : value;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 300) {
  return cleanText(value, max).toLowerCase();
}

function normalizeAttributeKey(value) {
  return cleanText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeAliasToken(value) {
  return cleanLower(value, 160)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function canonicalizeColorValue(value) {
  const token = normalizeAliasToken(value);
  return COLOR_VALUE_ALIASES.get(token) || token;
}

function normalizeCanonicalAttributes(attributes = []) {
  const source = Array.isArray(attributes)
    ? attributes
    : attributes && typeof attributes[Symbol.iterator] === 'function'
      ? Array.from(attributes)
      : [];
  const out = [];
  const seen = new Set();

  for (const rawAttribute of source) {
    const attribute = toPlain(rawAttribute) || {};
    const label = cleanText(
      attribute.label || attribute.name || attribute.key || '',
      120
    );
    const key = normalizeAttributeKey(
      attribute.key || attribute.name || label
    );
    const rawValue = cleanText(attribute.value || '', 160);
    const value = ['color', 'colour', 'tono'].includes(key)
      ? canonicalizeColorValue(rawValue)
      : rawValue;

    if (!key || !value || seen.has(key)) continue;

    seen.add(key);
    out.push({ key, label: label || key, value });
    if (out.length >= 4) break;
  }

  return out;
}

function encodeVariantKeyPart(value, max = 160) {
  return encodeURIComponent(cleanLower(value, max));
}

function stableVariantHash(value) {
  let first = 2166136261;
  let second = 5381;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second = Math.imul(second, 33) ^ code;
  }

  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

function buildVariantKey(size = '', color = '', attributes = []) {
  const normalizedAttributes = normalizeCanonicalAttributes(attributes);

  if (normalizedAttributes.length) {
    const pairs = [...normalizedAttributes]
      .sort((left, right) => left.key.localeCompare(right.key, 'es'))
      .map(
        (attribute) =>
          `${encodeVariantKeyPart(attribute.key, 80)}=${encodeVariantKeyPart(
            attribute.value,
            160
          )}`
      );
    const rawKey = `v2__${pairs.join('__')}`.toLowerCase();

    if (rawKey.length <= MAX_VARIANT_KEY_LENGTH) return rawKey;

    return `${rawKey.slice(0, 161)}__${stableVariantHash(rawKey)}`;
  }

  const cleanSize = cleanLower(size, 80);
  const cleanColor = canonicalizeColorValue(color).slice(0, 120);
  const key = `${cleanSize}__${cleanColor}`;
  return key === '__' ? DEFAULT_VARIANT_KEY : key;
}

function normalizeVariantKey(value) {
  const key = cleanLower(value, MAX_VARIANT_KEY_LENGTH);
  if (!key) return '';
  if (key === DEFAULT_VARIANT_KEY) return key;
  if (/[/\\\u0000-\u001f\u007f]/.test(key)) return '';

  if (key.startsWith('v2__')) {
    if (/^v2__.+__[0-9a-f]{16}$/.test(key)) return key;
    const pairs = key.slice(4).split('__');
    const valid = pairs.length > 0 && pairs.every((pair) => {
      const separator = pair.indexOf('=');
      if (separator <= 0 || separator === pair.length - 1) return false;
      return Boolean(
        normalizeAttributeKey(safeDecode(pair.slice(0, separator))) &&
          cleanText(safeDecode(pair.slice(separator + 1)), 160)
      );
    });
    return valid ? key : '';
  }

  const separator = key.indexOf('__');
  if (separator < 0) return '';

  const size = key.slice(0, separator);
  const color = key.slice(separator + 2);
  return size || color ? key : '';
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return '';
  }
}

function parseVariantKey(value) {
  const variantKey = normalizeVariantKey(value);
  if (!variantKey) return null;

  if (variantKey === DEFAULT_VARIANT_KEY) {
    return {
      format: 'default',
      variantKey,
      size: '',
      color: '',
      attributes: [],
    };
  }

  if (variantKey.startsWith('v2__')) {
    const rawPairs = variantKey.slice(4).split('__');
    const attributes = [];

    for (const rawPair of rawPairs) {
      const separator = rawPair.indexOf('=');
      if (separator <= 0) return null;
      const key = normalizeAttributeKey(safeDecode(rawPair.slice(0, separator)));
      const decodedValue = cleanText(safeDecode(rawPair.slice(separator + 1)), 160);
      if (!key || !decodedValue) return null;
      attributes.push({ key, label: key, value: decodedValue });
    }

    if (buildVariantKey('', '', attributes) !== variantKey) return null;

    const sizeAttribute = attributes.find((attribute) =>
      ['size', 'talla'].includes(attribute.key)
    );
    const colorAttribute = attributes.find((attribute) =>
      ['color', 'colour', 'tono'].includes(attribute.key)
    );

    return {
      format: 'attributes',
      variantKey,
      size: sizeAttribute?.value || '',
      color: colorAttribute?.value || '',
      attributes,
    };
  }

  const separator = variantKey.indexOf('__');
  return {
    format: 'simple',
    variantKey,
    size: variantKey.slice(0, separator),
    color: variantKey.slice(separator + 2),
    attributes: [],
  };
}

function canonicalizeVariantKey(value) {
  const variantKey = normalizeVariantKey(value);
  if (!variantKey) return '';
  if (variantKey === DEFAULT_VARIANT_KEY) return variantKey;
  if (variantKey.startsWith('v2__')) {
    const parsed = parseVariantKey(variantKey);
    return parsed
      ? buildVariantKey(parsed.size, parsed.color, parsed.attributes)
      : variantKey;
  }
  const separator = variantKey.indexOf('__');
  return buildVariantKey(
    variantKey.slice(0, separator),
    variantKey.slice(separator + 2)
  );
}

function copyAttributeLabels(canonicalAttributes, providedAttributes) {
  const labels = new Map(
    normalizeCanonicalAttributes(providedAttributes).map((attribute) => [
      attribute.key,
      attribute.label,
    ])
  );

  return canonicalAttributes.map((attribute) => ({
    ...attribute,
    label: labels.get(attribute.key) || attribute.label || attribute.key,
  }));
}

function createVariantIdentityError({ providedKey, generatedKey }) {
  const error = new Error(
    `variantKey incompatible: se recibio ${providedKey || '(vacio)'} y la variante corresponde a ${generatedKey}.`
  );
  error.code = 'VARIANT_KEY_MISMATCH';
  error.providedVariantKey = providedKey || '';
  error.expectedVariantKey = generatedKey;
  return error;
}

function resolveVariantIdentity(
  { variantKey = '', size = '', color = '', attributes = [] } = {},
  { strict = false } = {}
) {
  const cleanSize = cleanText(size, 80);
  const cleanColor = canonicalizeColorValue(color).slice(0, 120);
  const cleanAttributes = normalizeCanonicalAttributes(attributes);
  const generatedKey = buildVariantKey(
    cleanSize,
    cleanColor,
    cleanAttributes
  );
  const rawProvidedKey = cleanText(variantKey, MAX_VARIANT_KEY_LENGTH);
  const providedKey = normalizeVariantKey(rawProvidedKey);

  if (rawProvidedKey && !providedKey) {
    throw createVariantIdentityError({
      providedKey: rawProvidedKey,
      generatedKey,
    });
  }

  if (!providedKey) {
    return {
      variantKey: generatedKey,
      size: cleanSize,
      color: cleanColor,
      attributes: cleanAttributes,
      source: 'values',
    };
  }

  if (providedKey === generatedKey) {
    return {
      variantKey: providedKey,
      size: cleanSize,
      color: cleanColor,
      attributes: cleanAttributes,
      source: 'matching-key',
    };
  }

  if (strict) {
    throw createVariantIdentityError({ providedKey, generatedKey });
  }

  const parsed = parseVariantKey(providedKey);
  if (!parsed) {
    // Una clave v2 truncada sigue siendo compatible si los valores la reconstruyen.
    if (providedKey.startsWith('v2__') && generatedKey === providedKey) {
      return {
        variantKey: providedKey,
        size: cleanSize,
        color: cleanColor,
        attributes: cleanAttributes,
        source: 'matching-key',
      };
    }
    throw createVariantIdentityError({ providedKey, generatedKey });
  }

  const sizeMatches =
    !cleanSize || cleanLower(cleanSize, 80) === cleanLower(parsed.size, 80);
  const colorMatches =
    !cleanColor || cleanLower(cleanColor, 120) === cleanLower(parsed.color, 120);

  return {
    variantKey: providedKey,
    size: sizeMatches ? cleanSize || parsed.size : parsed.size,
    color: colorMatches ? cleanColor || parsed.color : parsed.color,
    attributes: parsed.attributes.length
      ? copyAttributeLabels(parsed.attributes, cleanAttributes)
      : [],
    source: 'key',
  };
}

function assertVariantIdentity(identity = {}) {
  return resolveVariantIdentity(identity, { strict: true });
}

module.exports = {
  DEFAULT_VARIANT_KEY,
  MAX_VARIANT_KEY_LENGTH,
  assertVariantIdentity,
  buildVariantKey,
  canonicalizeVariantKey,
  normalizeCanonicalAttributes,
  canonicalizeColorValue,
  normalizeVariantKey,
  parseVariantKey,
  resolveVariantIdentity,
};
