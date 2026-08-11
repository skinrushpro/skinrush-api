import { getWearRange } from './wear.js';

const recognisedKeys = new Set([
  'search',
  'weapon',
  'collection',
  'case',
  'source_type',
  'rarity',
  'stattrak',
  'souvenir',
  'float_min',
  'float_max',
  'wear',
  'limit',
  'offset'
]);

export class SkinQueryError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'SkinQueryError';
    this.code = 'INVALID_QUERY';
    this.field = field;
  }
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value) {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : [value];
  return [...new Set(
    raw
      .flatMap(item => String(item).split(','))
      .map(item => item.trim())
      .filter(Boolean)
  )];
}

function nullableText(value) {
  const text = first(value);
  if (text === undefined || text === null) return null;
  return String(text).trim() || null;
}

function booleanValue(field, value) {
  const text = first(value);
  if (text === undefined || text === null || text === '') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  throw new SkinQueryError(field, `${field} must be true or false`);
}

function floatValue(field, value) {
  const text = first(value);
  if (text === undefined || text === null || text === '') return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new SkinQueryError(field, `${field} must be a number between 0 and 1`);
  }
  if (parsed < 0 || parsed > 1) {
    throw new SkinQueryError(field, `${field} must be between 0 and 1`);
  }
  return parsed;
}

function integerValue(field, value, defaultValue, min, max, message) {
  const text = first(value);
  if (text === undefined || text === null || text === '') return defaultValue;
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    throw new SkinQueryError(field, message);
  }
  if (parsed < min || (max !== null && parsed > max)) {
    throw new SkinQueryError(
      field,
      field === 'limit' ? 'limit must be between 1 and 100' : 'offset must be zero or greater'
    );
  }
  return parsed;
}

function wears(value) {
  const values = list(value);
  for (const name of values) {
    if (!getWearRange(name)) {
      throw new SkinQueryError('wear', `wear contains an unsupported value: ${name}`);
    }
  }
  return values;
}

export function parseSkinQuery(rawQuery = {}) {
  const floatMin = floatValue('float_min', rawQuery.float_min);
  const floatMax = floatValue('float_max', rawQuery.float_max);

  if (floatMin !== null && floatMax !== null && floatMin > floatMax) {
    throw new SkinQueryError('float_min', 'float_min must not be greater than float_max');
  }

  return {
    enhanced: Object.keys(rawQuery).some(key => recognisedKeys.has(key)),
    search: nullableText(rawQuery.search),
    weapons: list(rawQuery.weapon),
    collections: list(rawQuery.collection),
    cases: list(rawQuery.case),
    sourceTypes: list(rawQuery.source_type),
    rarities: list(rawQuery.rarity),
    stattrak: booleanValue('stattrak', rawQuery.stattrak),
    souvenir: booleanValue('souvenir', rawQuery.souvenir),
    floatMin,
    floatMax,
    wears: wears(rawQuery.wear),
    limit: integerValue(
      'limit',
      rawQuery.limit,
      25,
      1,
      100,
      'limit must be an integer between 1 and 100'
    ),
    offset: integerValue(
      'offset',
      rawQuery.offset,
      0,
      0,
      null,
      'offset must be an integer zero or greater'
    )
  };
}

