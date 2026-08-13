export const DEFAULT_SKIN_SORT = 'weapon_asc';

export const SUPPORTED_SKIN_SORTS = Object.freeze([
  'weapon_asc',
  'name_asc',
  'rarity_desc',
  'rarity_asc',
  'float_min_asc',
  'float_max_desc'
]);

const SKIN_SORT_SET = new Set(SUPPORTED_SKIN_SORTS);

export function isSkinSort(value) {
  return SKIN_SORT_SET.has(value);
}
