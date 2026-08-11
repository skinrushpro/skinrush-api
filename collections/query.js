export class CollectionQueryError extends Error {
  constructor(field, message) {
    super(message);
    this.name = 'CollectionQueryError';
    this.code = 'INVALID_QUERY';
    this.field = field;
  }
}

function singleValue(value, field) {
  if (Array.isArray(value) || (value !== undefined && typeof value === 'object')) {
    throw new CollectionQueryError(field, `${field} must be a single value`);
  }

  return value;
}

function parseInteger(value, field, { minimum, maximum }) {
  const raw = singleValue(value, field);

  if (raw === undefined) {
    return null;
  }

  const text = String(raw);
  if (!/^\d+$/.test(text)) {
    throw new CollectionQueryError(field, `${field} must be an integer`);
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CollectionQueryError(
      field,
      `${field} must be between ${minimum} and ${maximum}`
    );
  }

  return parsed;
}

function parseActive(value) {
  const raw = singleValue(value, 'active');

  if (raw === undefined) {
    return null;
  }

  if (raw === 'true' || raw === true) {
    return true;
  }

  if (raw === 'false' || raw === false) {
    return false;
  }

  throw new CollectionQueryError('active', 'active must be true or false');
}

export function parseCollectionQuery(query) {
  const searchValue = singleValue(query.search, 'search');
  const search = searchValue === undefined
    ? null
    : String(searchValue).trim() || null;

  return {
    search,
    active: parseActive(query.active),
    limit: parseInteger(query.limit, 'limit', { minimum: 1, maximum: 100 }) ?? 24,
    offset: parseInteger(query.offset, 'offset', {
      minimum: 0,
      maximum: Number.MAX_SAFE_INTEGER
    }) ?? 0
  };
}

