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
