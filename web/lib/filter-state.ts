import { isItemCategory, type ItemCategory } from "./item-category.ts";

export const SKIN_SORTS = [
  "weapon_asc", "name_asc", "rarity_desc", "rarity_asc", "float_min_asc", "float_max_desc",
] as const;
export type SkinSort = typeof SKIN_SORTS[number];
export const DEFAULT_SKIN_SORT: SkinSort = "weapon_asc";

export interface FilterState {
  sort: SkinSort;
  search: string;
  categories: ItemCategory[];
  weapons: string[];
  collections: string[];
  cases: string[];
  sourceTypes: string[];
  rarities: string[];
  wears: string[];
  stattrak: boolean | null;
  souvenir: boolean | null;
  floatMin: number | null;
  floatMax: number | null;
  limit: number;
  offset: number;
}

export type ListFilterKey = "categories" | "weapons" | "collections" | "cases" | "sourceTypes" | "rarities" | "wears";
export type ScalarFilterKey = "search" | "stattrak" | "souvenir" | "floatMin" | "floatMax";

const OWNED_KEYS = [
  "search", "sort", "category", "weapon", "collection", "case", "source_type", "rarity", "wear",
  "stattrak", "souvenir", "float_min", "float_max", "limit", "offset",
] as const;

function parseList(value: string | null): string[] {
  return value ? [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))] : [];
}

function parseCategories(value: string | null): ItemCategory[] {
  return parseList(value).filter(isItemCategory);
}

function parseBoolean(value: string | null): boolean | null {
  return value === "true" ? true : value === "false" ? false : null;
}

function parseFloatValue(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : null;
}

function parseInteger(value: string | null, fallback: number, minimum: number, maximum?: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && (maximum === undefined || parsed <= maximum)
    ? parsed : fallback;
}

function isSkinSort(value: string | null): value is SkinSort {
  return value !== null && (SKIN_SORTS as readonly string[]).includes(value);
}

export function createDefaultFilterState(pageSize = 25): FilterState {
  return {
    sort: DEFAULT_SKIN_SORT, search: "", categories: [], weapons: [], collections: [], cases: [], sourceTypes: [],
    rarities: [], wears: [], stattrak: null, souvenir: null, floatMin: null, floatMax: null,
    limit: pageSize, offset: 0,
  };
}

export function parseFilterState(params: URLSearchParams, pageSize = 25): FilterState {
  let floatMin = parseFloatValue(params.get("float_min"));
  let floatMax = parseFloatValue(params.get("float_max"));
  if (floatMin !== null && floatMax !== null && floatMin > floatMax) {
    floatMin = null;
    floatMax = null;
  }
  const sort = params.get("sort");
  return {
    sort: isSkinSort(sort) ? sort : DEFAULT_SKIN_SORT,
    search: params.get("search")?.trim() || "",
    categories: parseCategories(params.get("category")),
    weapons: parseList(params.get("weapon")),
    collections: parseList(params.get("collection")),
    cases: parseList(params.get("case")),
    sourceTypes: parseList(params.get("source_type")),
    rarities: parseList(params.get("rarity")),
    wears: parseList(params.get("wear")),
    stattrak: parseBoolean(params.get("stattrak")),
    souvenir: parseBoolean(params.get("souvenir")),
    floatMin, floatMax,
    limit: parseInteger(params.get("limit"), pageSize, 1, 100),
    offset: parseInteger(params.get("offset"), 0, 0),
  };
}

function setList(params: URLSearchParams, key: string, values: string[]) {
  if (values.length) params.set(key, values.join(","));
}

export function serialiseFilterState(
  state: FilterState,
  existing = new URLSearchParams(),
  pageSize = 25,
): URLSearchParams {
  const params = new URLSearchParams(existing);
  for (const key of OWNED_KEYS) params.delete(key);
  if (state.sort !== DEFAULT_SKIN_SORT) params.set("sort", state.sort);
  if (state.search.trim()) params.set("search", state.search.trim());
  setList(params, "category", state.categories);
  setList(params, "weapon", state.weapons);
  setList(params, "collection", state.collections);
  setList(params, "case", state.cases);
  setList(params, "source_type", state.sourceTypes);
  setList(params, "rarity", state.rarities);
  setList(params, "wear", state.wears);
  if (state.stattrak !== null) params.set("stattrak", String(state.stattrak));
  if (state.souvenir !== null) params.set("souvenir", String(state.souvenir));
  if (state.floatMin !== null) params.set("float_min", String(state.floatMin));
  if (state.floatMax !== null) params.set("float_max", String(state.floatMax));
  if (state.limit !== pageSize) params.set("limit", String(state.limit));
  if (state.offset > 0) params.set("offset", String(state.offset));
  return params;
}

export function removeFilter(
  state: FilterState,
  key: ListFilterKey | ScalarFilterKey,
  value?: string,
): FilterState {
  if (["categories", "weapons", "collections", "cases", "sourceTypes", "rarities", "wears"].includes(key)) {
    const listKey = key as ListFilterKey;
    return { ...state, [listKey]: state[listKey].filter((item) => item !== value), offset: 0 };
  }
  return { ...state, [key]: key === "search" ? "" : null, offset: 0 };
}

export function clearFilters(state: FilterState, pageSize = 25): FilterState {
  return { ...createDefaultFilterState(pageSize), sort: state.sort };
}
