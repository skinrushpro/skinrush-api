import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SkinQueryError, parseSkinQuery } from '../skins/query.js';
import { getAvailableWears } from '../skins/wear.js';

const boundaries = [
  [0.07, 'Factory New', 'Minimal Wear'],
  [0.15, 'Minimal Wear', 'Field-Tested'],
  [0.38, 'Field-Tested', 'Well-Worn'],
  [0.45, 'Well-Worn', 'Battle-Scarred']
];

for (const [value, excluded, included] of boundaries) {
  test(`${value} belongs to ${included}, not ${excluded}`, () => {
    const wears = getAvailableWears(value, value);
    assert.equal(wears.includes(included), true);
    assert.equal(wears.includes(excluded), false);
  });

  test(`a range spanning ${value} supports both adjacent wears`, () => {
    const wears = getAvailableWears(value - 0.001, value + 0.001);
    assert.equal(wears.includes(excluded), true);
    assert.equal(wears.includes(included), true);
  });
}

test('skin query defaults preserve the legacy listing contract', () => {
  assert.deepEqual(parseSkinQuery({}), {
    enhanced: false,
    search: null,
    weapons: [],
    collections: [],
    cases: [],
    sourceTypes: [],
    rarities: [],
    stattrak: null,
    souvenir: null,
    floatMin: null,
    floatMax: null,
    wears: [],
    limit: 25,
    offset: 0
  });
});

test('skin query parses combined readable filters', () => {
  assert.deepEqual(parseSkinQuery({
    search: '  redline ',
    weapon: 'AK-47,AWP,AK-47',
    collection: 'the_falchion_collection',
    case: 'case-4091,case-4001',
    source_type: 'case,souvenir_package',
    rarity: 'Classified,Covert',
    stattrak: 'true',
    souvenir: 'false',
    float_min: '0.07',
    float_max: '0.38',
    wear: 'Minimal Wear,Field-Tested',
    limit: '25',
    offset: '50'
  }), {
    enhanced: true,
    search: 'redline',
    weapons: ['AK-47', 'AWP'],
    collections: ['the_falchion_collection'],
    cases: ['case-4091', 'case-4001'],
    sourceTypes: ['case', 'souvenir_package'],
    rarities: ['Classified', 'Covert'],
    stattrak: true,
    souvenir: false,
    floatMin: 0.07,
    floatMax: 0.38,
    wears: ['Minimal Wear', 'Field-Tested'],
    limit: 25,
    offset: 50
  });
});

test('array query values are flattened, trimmed, and deduplicated', () => {
  const query = parseSkinQuery({ weapon: ['AK-47, AWP', 'AWP', 'Glock-18'] });
  assert.deepEqual(query.weapons, ['AK-47', 'AWP', 'Glock-18']);
});

test('an empty search remains null but opts into enhanced listing', () => {
  const query = parseSkinQuery({ search: '   ' });
  assert.equal(query.enhanced, true);
  assert.equal(query.search, null);
});

for (const [field, value, message] of [
  ['stattrak', 'yes', 'stattrak must be true or false'],
  ['souvenir', 'no', 'souvenir must be true or false'],
  ['float_min', '-0.01', 'float_min must be between 0 and 1'],
  ['float_max', '1.01', 'float_max must be between 0 and 1'],
  ['float_min', 'later', 'float_min must be a number between 0 and 1'],
  ['limit', '0', 'limit must be between 1 and 100'],
  ['limit', '101', 'limit must be between 1 and 100'],
  ['limit', '2.5', 'limit must be an integer between 1 and 100'],
  ['offset', '-1', 'offset must be zero or greater'],
  ['offset', 'later', 'offset must be an integer zero or greater'],
  ['wear', 'Pristine', 'wear contains an unsupported value: Pristine']
]) {
  test(`skin query rejects invalid ${field} value ${value}`, () => {
    assert.throws(
      () => parseSkinQuery({ [field]: value }),
      error => error instanceof SkinQueryError
        && error.code === 'INVALID_QUERY'
        && error.field === field
        && error.message === message
    );
  });
}

test('skin query rejects a reversed float interval', () => {
  assert.throws(
    () => parseSkinQuery({ float_min: '0.45', float_max: '0.07' }),
    error => error instanceof SkinQueryError
      && error.field === 'float_min'
      && error.message === 'float_min must not be greater than float_max'
  );
});

