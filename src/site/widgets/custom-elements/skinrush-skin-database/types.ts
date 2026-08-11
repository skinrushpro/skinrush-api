export interface WearDefinition {
  name: string;
  min: number;
  max: number;
  maxInclusive: boolean;
}

export interface SkinCollection {
  id: string;
  name: string;
}

export interface SkinCase {
  id: string;
  name: string;
  sourceType: string;
}

export interface SkinResult {
  id: string;
  name: string;
  weapon: string;
  rarity: string | null;
  rarityColor: string | null;
  category: string | null;
  min_float: number;
  max_float: number;
  stattrak: boolean;
  souvenir: boolean;
  image: string | null;
  phase: string | null;
  description: string | null;
  collections: SkinCollection[];
  cases: SkinCase[];
  availableWears: string[];
}

export interface FilterOptions {
  weapons: string[];
  collections: SkinCollection[];
  cases: SkinCase[];
  sourceTypes: string[];
  rarities: string[];
  wears: WearDefinition[];
}

export interface FilterState {
  search: string;
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

export interface SkinPage {
  items: SkinResult[];
  total: number;
}

