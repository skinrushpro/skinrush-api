export const WEAR_RANGES = Object.freeze([
  Object.freeze({ name: 'Factory New', min: 0, max: 0.07, maxInclusive: false }),
  Object.freeze({ name: 'Minimal Wear', min: 0.07, max: 0.15, maxInclusive: false }),
  Object.freeze({ name: 'Field-Tested', min: 0.15, max: 0.38, maxInclusive: false }),
  Object.freeze({ name: 'Well-Worn', min: 0.38, max: 0.45, maxInclusive: false }),
  Object.freeze({ name: 'Battle-Scarred', min: 0.45, max: 1, maxInclusive: true })
]);

export function getWearRange(name) {
  return WEAR_RANGES.find(range => range.name === name) || null;
}

function overlaps(minFloat, maxFloat, wear) {
  return wear.maxInclusive
    ? maxFloat >= wear.min && minFloat <= wear.max
    : maxFloat >= wear.min && minFloat < wear.max;
}

export function getAvailableWears(minFloat, maxFloat) {
  if (!Number.isFinite(minFloat) || !Number.isFinite(maxFloat)) return [];
  if (minFloat < 0 || maxFloat > 1 || minFloat > maxFloat) return [];
  return WEAR_RANGES
    .filter(wear => overlaps(minFloat, maxFloat, wear))
    .map(wear => wear.name);
}

