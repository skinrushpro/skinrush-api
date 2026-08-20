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

const RARITY_RANK_SQL = `CASE s.rarity_name
  WHEN 'Consumer Grade' THEN 1
  WHEN 'Industrial Grade' THEN 2
  WHEN 'Mil-Spec Grade' THEN 3
  WHEN 'Restricted' THEN 4
  WHEN 'Classified' THEN 5
  WHEN 'Covert' THEN 6
  WHEN 'Extraordinary' THEN 7
  ELSE NULL
END`;

const SORT_SQL = Object.freeze({
  weapon_asc: 's.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  name_asc: 's.skin_name ASC, s.weapon_name ASC, s.skin_id ASC',
  rarity_desc: `${RARITY_RANK_SQL} DESC NULLS LAST, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC`,
  rarity_asc: `${RARITY_RANK_SQL} ASC NULLS LAST, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC`,
  float_min_asc: 's.min_float ASC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  float_max_desc: 's.max_float DESC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC'
});

const SEARCH_RELEVANCE_SQL = `CASE
  WHEN LOWER(s.skin_name) = LOWER(:searchExact) THEN 1
  WHEN LOWER(s.skin_name) LIKE LOWER(:searchPrefix) THEN 2
  WHEN LOWER(s.weapon_name) = LOWER(:searchExact) THEN 3
  WHEN LOWER(s.weapon_name) LIKE LOWER(:searchPrefix) THEN 4
  WHEN LOWER(s.skin_name) LIKE LOWER(:searchContains) THEN 5
  WHEN LOWER(s.weapon_name) LIKE LOWER(:searchContains) THEN 6
  ELSE 7
END ASC`;

export function buildSkinOrder(query) {
  const sortSql = SORT_SQL[query.sort] ?? SORT_SQL[DEFAULT_SKIN_SORT];
  if (!query.search) return { sql: sortSql, replacements: {} };
  return {
    sql: `${SEARCH_RELEVANCE_SQL}, ${sortSql}`,
    replacements: {
      searchExact: query.search,
      searchPrefix: `${query.search}%`,
      searchContains: `%${query.search}%`
    }
  };
}
