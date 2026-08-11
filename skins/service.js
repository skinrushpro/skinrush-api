import { QueryTypes } from 'sequelize';

import { WEAR_RANGES, getAvailableWears, getWearRange } from './wear.js';

function buildWhere(query) {
  const conditions = [];
  const replacements = {};

  if (query.search) {
    conditions.push('(s.skin_name ILIKE :search OR s.weapon_name ILIKE :search)');
    replacements.search = `%${query.search}%`;
  }
  if (query.weapons.length) {
    conditions.push('s.weapon_name IN (:weapons)');
    replacements.weapons = query.weapons;
  }
  if (query.collections.length) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM skin_collections selected_sc
      WHERE selected_sc.skin_id = s.skin_id
        AND selected_sc.collection_id IN (:collections)
    )`);
    replacements.collections = query.collections;
  }
  if (query.cases.length) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM skin_cases selected_case
      WHERE selected_case.skin_id = s.skin_id
        AND selected_case.case_id IN (:cases)
    )`);
    replacements.cases = query.cases;
  }
  if (query.sourceTypes.length) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM skin_cases source_link
      JOIN cases source_case ON source_case.case_id = source_link.case_id
      WHERE source_link.skin_id = s.skin_id
        AND source_case.source_type IN (:sourceTypes)
    )`);
    replacements.sourceTypes = query.sourceTypes;
  }
  if (query.rarities.length) {
    conditions.push('s.rarity_name IN (:rarities)');
    replacements.rarities = query.rarities;
  }
  if (query.stattrak !== null) {
    conditions.push('s.stattrak = :stattrak');
    replacements.stattrak = query.stattrak;
  }
  if (query.souvenir !== null) {
    conditions.push('s.souvenir = :souvenir');
    replacements.souvenir = query.souvenir;
  }
  if (query.floatMin !== null) {
    conditions.push('s.max_float >= :floatMin');
    replacements.floatMin = query.floatMin;
  }
  if (query.floatMax !== null) {
    conditions.push('s.min_float <= :floatMax');
    replacements.floatMax = query.floatMax;
  }
  if (query.wears.length) {
    const wearConditions = query.wears.map((name, index) => {
      const wear = getWearRange(name);
      replacements[`wearMin${index}`] = wear.min;
      replacements[`wearMax${index}`] = wear.max;
      const upperOperator = wear.maxInclusive ? '<=' : '<';
      return `(s.max_float >= :wearMin${index} AND s.min_float ${upperOperator} :wearMax${index})`;
    });
    conditions.push(`(${wearConditions.join(' OR ')})`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join('\n  AND ')}` : '',
    replacements
  };
}

function mapSkin(row) {
  const minFloat = Number(row.min_float);
  const maxFloat = Number(row.max_float);

  return {
    id: row.id,
    name: row.name,
    weapon: row.weapon,
    rarity: row.rarity,
    rarityColor: row.rarityColor,
    category: row.category,
    min_float: minFloat,
    max_float: maxFloat,
    stattrak: row.stattrak,
    souvenir: row.souvenir,
    image: row.image,
    phase: row.phase,
    description: row.description,
    collections: Array.isArray(row.collections) ? row.collections : [],
    cases: Array.isArray(row.cases) ? row.cases : [],
    availableWears: getAvailableWears(minFloat, maxFloat)
  };
}

const LIST_SQL = `
WITH collection_data AS (
  SELECT sc.skin_id,
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.collection_id,
           'name', c.collection_name
         )) AS collections
  FROM skin_collections sc
  JOIN collections c ON c.collection_id = sc.collection_id
  GROUP BY sc.skin_id
), case_data AS (
  SELECT sc.skin_id,
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.case_id,
           'name', c.case_name,
           'sourceType', c.source_type
         )) AS cases
  FROM skin_cases sc
  JOIN cases c ON c.case_id = sc.case_id
  GROUP BY sc.skin_id
)
SELECT s.skin_id AS id,
       s.skin_name AS name,
       s.weapon_name AS weapon,
       s.rarity_name AS rarity,
       s.rarity_color AS "rarityColor",
       s.category_name AS category,
       s.min_float,
       s.max_float,
       s.stattrak,
       s.souvenir,
       s.image_url AS image,
       s.phase,
       s.description,
       COALESCE(cd.collections, '[]'::jsonb) AS collections,
       COALESCE(cad.cases, '[]'::jsonb) AS cases
FROM skins s
LEFT JOIN collection_data cd ON cd.skin_id = s.skin_id
LEFT JOIN case_data cad ON cad.skin_id = s.skin_id
`;

const OPTIONS_SQL = `
SELECT jsonb_build_object(
  'weapons', (
    SELECT COALESCE(jsonb_agg(weapon_name ORDER BY weapon_name), '[]'::jsonb)
    FROM (SELECT DISTINCT weapon_name FROM skins WHERE weapon_name IS NOT NULL) values_
  ),
  'collections', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', collection_id,
      'name', collection_name
    ) ORDER BY collection_name, collection_id), '[]'::jsonb)
    FROM collections
  ),
  'cases', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', case_id,
      'name', case_name,
      'sourceType', source_type
    ) ORDER BY case_name, case_id), '[]'::jsonb)
    FROM cases
  ),
  'sourceTypes', (
    SELECT COALESCE(jsonb_agg(source_type ORDER BY source_type), '[]'::jsonb)
    FROM (SELECT DISTINCT source_type FROM cases WHERE source_type IS NOT NULL) values_
  ),
  'rarities', (
    SELECT COALESCE(jsonb_agg(rarity_name ORDER BY rarity_name), '[]'::jsonb)
    FROM (SELECT DISTINCT rarity_name FROM skins WHERE rarity_name IS NOT NULL) values_
  )
) AS options
`;

export function createSkinService({ sequelize, Skin }) {
  return {
    legacyList() {
      return Skin.findAll();
    },

    async search(query) {
      const { where, replacements } = buildWhere(query);
      const listReplacements = {
        ...replacements,
        limit: query.limit,
        offset: query.offset
      };
      const listSql = `${LIST_SQL}${where}
ORDER BY s.weapon_name, s.skin_name, s.skin_id
LIMIT :limit OFFSET :offset`;
      const countSql = `SELECT COUNT(*)::integer AS total FROM skins s ${where}`;

      const [rows, countRows] = await Promise.all([
        sequelize.query(listSql, {
          replacements: listReplacements,
          type: QueryTypes.SELECT
        }),
        sequelize.query(countSql, {
          replacements: { ...replacements },
          type: QueryTypes.SELECT
        })
      ]);

      return {
        items: rows.map(mapSkin),
        total: Number(countRows[0]?.total || 0)
      };
    },

    async filterOptions() {
      const rows = await sequelize.query(OPTIONS_SQL, { type: QueryTypes.SELECT });
      const options = rows[0]?.options || {};
      return {
        weapons: options.weapons || [],
        collections: options.collections || [],
        cases: options.cases || [],
        sourceTypes: options.sourceTypes || [],
        rarities: options.rarities || [],
        wears: WEAR_RANGES.map(range => ({ ...range }))
      };
    }
  };
}
