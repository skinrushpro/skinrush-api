import type { FilterState } from './types';

const OWNED_KEYS = [
  'search',
  'weapon',
  'collection',
  'case',
  'source_type',
  'rarity',
  'wear',
  'stattrak',
  'souvenir',
  'float_min',
  'float_max',
  'limit',
  'offset',
] as const;

type ListFilterKey = 'weapons' | 'collections' | 'cases'
  | 'sourceTypes' | 'rarities' | 'wears';
type ScalarFilterKey = 'search' | 'stattrak' | 'souvenir' | 'floatMin' | 'floatMax';

function parseList(value: string | null): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function parseBoolean(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseFloatValue(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function parseInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number | null,
): number {
  if (value === null || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  if (maximum !== null && parsed > maximum) return fallback;
  return parsed;
}

export function createDefaultFilterState(pageSize = 25): FilterState {
  return {
    search: '',
    weapons: [],
    collections: [],
    cases: [],
    sourceTypes: [],
    rarities: [],
    wears: [],
    stattrak: null,
    souvenir: null,
    floatMin: null,
    floatMax: null,
    limit: pageSize,
    offset: 0,
  };
}

export function parseFilterState(
  params: URLSearchParams,
  pageSize = 25,
): FilterState {
  let floatMin = parseFloatValue(params.get('float_min'));
  let floatMax = parseFloatValue(params.get('float_max'));
  if (floatMin !== null && floatMax !== null && floatMin > floatMax) {
    floatMin = null;
    floatMax = null;
  }

  return {
    search: params.get('search')?.trim() || '',
    weapons: parseList(params.get('weapon')),
    collections: parseList(params.get('collection')),
    cases: parseList(params.get('case')),
    sourceTypes: parseList(params.get('source_type')),
    rarities: parseList(params.get('rarity')),
    wears: parseList(params.get('wear')),
    stattrak: parseBoolean(params.get('stattrak')),
    souvenir: parseBoolean(params.get('souvenir')),
    floatMin,
    floatMax,
    limit: parseInteger(params.get('limit'), pageSize, 1, 100),
    offset: parseInteger(params.get('offset'), 0, 0, null),
  };
}

function setList(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length) params.set(key, values.join(','));
}

export function serialiseFilterState(
  state: FilterState,
  existing = new URLSearchParams(),
  pageSize = 25,
): URLSearchParams {
  const params = new URLSearchParams(existing);
  for (const key of OWNED_KEYS) params.delete(key);

  if (state.search.trim()) params.set('search', state.search.trim());
  setList(params, 'weapon', state.weapons);
  setList(params, 'collection', state.collections);
  setList(params, 'case', state.cases);
  setList(params, 'source_type', state.sourceTypes);
  setList(params, 'rarity', state.rarities);
  setList(params, 'wear', state.wears);
  if (state.stattrak !== null) params.set('stattrak', String(state.stattrak));
  if (state.souvenir !== null) params.set('souvenir', String(state.souvenir));
  if (state.floatMin !== null) params.set('float_min', String(state.floatMin));
  if (state.floatMax !== null) params.set('float_max', String(state.floatMax));
  if (state.limit !== pageSize) params.set('limit', String(state.limit));
  if (state.offset > 0) params.set('offset', String(state.offset));
  return params;
}

export function removeFilter(
  state: FilterState,
  key: ListFilterKey | ScalarFilterKey,
  value?: string,
): FilterState {
  if (
    key === 'weapons'
    || key === 'collections'
    || key === 'cases'
    || key === 'sourceTypes'
    || key === 'rarities'
    || key === 'wears'
  ) {
    return {
      ...state,
      [key]: state[key].filter(item => item !== value),
      offset: 0,
    };
  }

  const clearedValue = key === 'search' ? '' : null;
  return { ...state, [key]: clearedValue, offset: 0 };
}

export function clearFilters(_state: FilterState, pageSize = 25): FilterState {
  return createDefaultFilterState(pageSize);
}
