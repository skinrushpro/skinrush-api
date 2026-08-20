import { ITEM_CATEGORIES, isItemCategory, type ItemCategory } from "./item-category.ts";

export interface PublicSkin {
  id: string;
  name: string;
  weapon: string;
  rarity: string | null;
}

export interface CataloguePage {
  items: PublicSkin[];
  total: number;
}

export interface NamedOption {
  id: string;
  name: string;
}

export interface CaseOption extends NamedOption {
  sourceType: string;
}

export interface WearOption {
  name: string;
  min: number;
  max: number;
  maxInclusive: boolean;
}

export interface FilterOptions {
  weapons: string[];
  weaponCategories: WeaponCategoryOption[];
  collections: NamedOption[];
  cases: CaseOption[];
  sourceTypes: string[];
  rarities: string[];
  wears: WearOption[];
}

export interface WeaponCategoryOption {
  id: ItemCategory;
  name: string;
  weapons: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePublicSkin(value: unknown): PublicSkin | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.name !== "string"
    || typeof value.weapon !== "string"
    || (value.rarity !== null && typeof value.rarity !== "string")
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    weapon: value.weapon,
    rarity: value.rarity,
  };
}

export function parseCataloguePage(value: unknown): CataloguePage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  if (!Number.isSafeInteger(value.total) || Number(value.total) < 0) return null;

  const items = value.items.map(parsePublicSkin);
  if (items.some((item) => item === null)) return null;

  return {
    items: items as PublicSkin[],
    total: Number(value.total),
  };
}

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

export function parseFilterOptions(value: unknown): FilterOptions | null {
  if (!isRecord(value)) return null;
  const weapons = stringList(value.weapons);
  const sourceTypes = stringList(value.sourceTypes);
  const rarities = stringList(value.rarities);
  if (!weapons || !sourceTypes || !rarities || !Array.isArray(value.weaponCategories)) return null;
  if (!Array.isArray(value.collections) || !Array.isArray(value.cases) || !Array.isArray(value.wears)) {
    return null;
  }

  const collections = value.collections.map((item) => isRecord(item)
    && typeof item.id === "string" && typeof item.name === "string"
    ? { id: item.id, name: item.name }
    : null);
  const weaponCategories = value.weaponCategories.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || !isItemCategory(item.id)) return null;
    const expected = ITEM_CATEGORIES.find(({ id }) => id === item.id);
    const categoryWeapons = stringList(item.weapons);
    return expected && item.name === expected.name && categoryWeapons
      ? { id: item.id, name: item.name, weapons: categoryWeapons }
      : null;
  });
  const cases = value.cases.map((item) => isRecord(item)
    && typeof item.id === "string" && typeof item.name === "string"
    && typeof item.sourceType === "string"
    ? { id: item.id, name: item.name, sourceType: item.sourceType }
    : null);
  const wears = value.wears.map((item) => isRecord(item)
    && typeof item.name === "string" && typeof item.min === "number"
    && typeof item.max === "number" && typeof item.maxInclusive === "boolean"
    ? { name: item.name, min: item.min, max: item.max, maxInclusive: item.maxInclusive }
    : null);
  if ([...weaponCategories, ...collections, ...cases, ...wears].some((item) => item === null)) return null;
  if (
    weaponCategories.length !== ITEM_CATEGORIES.length
    || new Set(weaponCategories.map((item) => item?.id)).size !== ITEM_CATEGORIES.length
  ) return null;

  return {
    weapons,
    weaponCategories: weaponCategories as WeaponCategoryOption[],
    collections: collections as NamedOption[],
    cases: cases as CaseOption[],
    sourceTypes,
    rarities,
    wears: wears as WearOption[],
  };
}
