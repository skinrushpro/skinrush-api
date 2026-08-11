import type { WearDefinition } from './types';

export const WEAR_DEFINITIONS: readonly WearDefinition[] = Object.freeze([
  Object.freeze({ name: 'Factory New', min: 0, max: 0.07, maxInclusive: false }),
  Object.freeze({ name: 'Minimal Wear', min: 0.07, max: 0.15, maxInclusive: false }),
  Object.freeze({ name: 'Field-Tested', min: 0.15, max: 0.38, maxInclusive: false }),
  Object.freeze({ name: 'Well-Worn', min: 0.38, max: 0.45, maxInclusive: false }),
  Object.freeze({ name: 'Battle-Scarred', min: 0.45, max: 1, maxInclusive: true }),
]);

export const WEAR_ABBREVIATIONS: Readonly<Record<string, string>> = Object.freeze({
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
});
