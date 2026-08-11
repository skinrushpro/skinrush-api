import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearFilters,
  createDefaultFilterState,
  parseFilterState,
  removeFilter,
  serialiseFilterState,
} from '../src/site/widgets/custom-elements/skinrush-skin-database/filter-state.ts';
import type { FilterState } from '../src/site/widgets/custom-elements/skinrush-skin-database/types.ts';

test('filter state survives a readable URL round trip', () => {
  const state = {
    search: 'red line',
    weapons: ['AK-47', 'AWP'],
    collections: ['the_falchion_collection'],
    cases: [],
    sourceTypes: ['souvenir_package'],
    rarities: ['Covert'],
    wears: ['Factory New'],
    stattrak: true,
    souvenir: false,
    floatMin: 0,
    floatMax: 0.07,
    limit: 25,
    offset: 0,
  } satisfies FilterState;

  const params = serialiseFilterState(
    state,
    new URLSearchParams('ref=nav'),
    25,
  );

  assert.equal(params.get('ref'), 'nav');
  assert.equal(params.get('weapon'), 'AK-47,AWP');
  assert.equal(params.get('limit'), null);
  assert.deepEqual(parseFilterState(params, 25), state);
});

test('default filter state is empty and uses the configured page size', () => {
  assert.deepEqual(createDefaultFilterState(40), {
    search: '',
    weapons: [],
    collections: [],
    cases: [],
    sourceTypes: [],
    rarities: [],
    wears: [],
    stattrak: null,
    souvenir: null,
    floatMin: null,
    floatMax: null,
    limit: 40,
    offset: 0,
  });
});

test('URL parsing preserves false tri-state values and explicit pagination', () => {
  const state = parseFilterState(new URLSearchParams(
    'stattrak=false&souvenir=false&limit=10&offset=20',
  ));

  assert.equal(state.stattrak, false);
  assert.equal(state.souvenir, false);
  assert.equal(state.limit, 10);
  assert.equal(state.offset, 20);
});

test('URL parsing safely ignores malformed numeric and Boolean values', () => {
  const state = parseFilterState(new URLSearchParams(
    'float_min=-1&float_max=later&limit=500&offset=-4&stattrak=yes',
  ));

  assert.equal(state.floatMin, null);
  assert.equal(state.floatMax, null);
  assert.equal(state.limit, 25);
  assert.equal(state.offset, 0);
  assert.equal(state.stattrak, null);
});

test('removing one active value retains its siblings and resets pagination', () => {
  const state = {
    ...createDefaultFilterState(),
    weapons: ['AK-47', 'AWP'],
    offset: 50,
  };

  assert.deepEqual(removeFilter(state, 'weapons', 'AK-47'), {
    ...state,
    weapons: ['AWP'],
    offset: 0,
  });
});

test('clear filters and serialisation retain unrelated page parameters', () => {
  const state = {
    ...createDefaultFilterState(),
    search: 'redline',
    collections: ['the_falchion_collection'],
    stattrak: true,
    offset: 25,
  };
  const cleared = clearFilters(state, 25);
  const params = serialiseFilterState(
    cleared,
    new URLSearchParams(
      'ref=nav&search=old&collection=old&stattrak=true&offset=25',
    ),
    25,
  );

  assert.deepEqual(cleared, createDefaultFilterState());
  assert.equal(params.toString(), 'ref=nav');
});

