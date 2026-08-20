export const ITEM_CATEGORIES = [
  { id: "rifles", name: "Rifles" },
  { id: "pistols", name: "Pistols" },
  { id: "smgs", name: "SMGs" },
  { id: "heavy", name: "Heavy" },
  { id: "knives", name: "Knives" },
  { id: "gloves", name: "Gloves" },
  { id: "equipment", name: "Equipment" },
] as const;

export type ItemCategory = typeof ITEM_CATEGORIES[number]["id"];

const ITEM_CATEGORY_IDS = new Set<string>(ITEM_CATEGORIES.map(({ id }) => id));

export function isItemCategory(value: string): value is ItemCategory {
  return ITEM_CATEGORY_IDS.has(value);
}
