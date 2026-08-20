export const SKIN_CATEGORIES = [
  { id: 'rifles', name: 'Rifles', itemType: 'weapon', categoryName: 'Rifles' },
  { id: 'pistols', name: 'Pistols', itemType: 'weapon', categoryName: 'Pistols' },
  { id: 'smgs', name: 'SMGs', itemType: 'weapon', categoryName: 'SMGs' },
  { id: 'heavy', name: 'Heavy', itemType: 'weapon', categoryName: 'Heavy' },
  { id: 'knives', name: 'Knives', itemType: 'knife', categoryName: null },
  { id: 'gloves', name: 'Gloves', itemType: 'gloves', categoryName: null },
  { id: 'equipment', name: 'Equipment', itemType: 'weapon', categoryName: 'Equipment' }
];

const CATEGORY_IDS = new Set(SKIN_CATEGORIES.map(category => category.id));

export function isSkinCategory(value) {
  return CATEGORY_IDS.has(value);
}

export const SKIN_CATEGORY_SQL = `CASE
  WHEN s.item_type = 'knife' THEN 'knives'
  WHEN s.item_type = 'gloves' THEN 'gloves'
  WHEN s.item_type = 'weapon' AND s.category_name = 'Rifles' THEN 'rifles'
  WHEN s.item_type = 'weapon' AND s.category_name = 'Pistols' THEN 'pistols'
  WHEN s.item_type = 'weapon' AND s.category_name = 'SMGs' THEN 'smgs'
  WHEN s.item_type = 'weapon' AND s.category_name = 'Heavy' THEN 'heavy'
  WHEN s.item_type = 'weapon' AND s.category_name = 'Equipment' THEN 'equipment'
  ELSE NULL
END`;

export const SKIN_CATEGORY_VALUES_SQL = SKIN_CATEGORIES
  .map((category, index) => `('${category.id}', '${category.name}', ${index + 1})`)
  .join(',\n    ');
