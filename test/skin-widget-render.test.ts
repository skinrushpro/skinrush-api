import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { createDefaultFilterState } from '../src/site/widgets/custom-elements/skinrush-skin-database/filter-state';
import { renderFilters } from '../src/site/widgets/custom-elements/skinrush-skin-database/render-filters';
import { renderResults } from '../src/site/widgets/custom-elements/skinrush-skin-database/render-results';
import type {
  FilterOptions,
  SkinResult,
} from '../src/site/widgets/custom-elements/skinrush-skin-database/types';

const options: FilterOptions = {
  weapons: ['AK-47', 'FAMAS'],
  collections: [{ id: 'the_falchion_collection', name: 'The Falchion Collection' }],
  cases: [{ id: 'operation_riptide_case', name: 'Operation Riptide Case', sourceType: 'Case' }],
  sourceTypes: ['Case'],
  rarities: ['Restricted'],
  wears: [
    { name: 'Factory New', min: 0, max: 0.07, maxInclusive: false },
    { name: 'Minimal Wear', min: 0.07, max: 0.15, maxInclusive: false },
  ],
};

const skin: SkinResult = {
  id: 'famas_zx_spectron',
  name: 'ZX Spectron',
  weapon: 'FAMAS',
  rarity: 'Restricted',
  rarityColor: '#8847ff',
  category: 'Rifle',
  min_float: 0,
  max_float: 0.9,
  stattrak: true,
  souvenir: false,
  image: '',
  phase: null,
  description: 'A custom painted FAMAS finish.',
  collections: [{ id: 'the_falchion_collection', name: 'The Falchion Collection' }],
  cases: [{ id: 'operation_riptide_case', name: 'Operation Riptide Case', sourceType: 'Case' }],
  availableWears: ['Factory New', 'Minimal Wear'],
};

test('filters render semantic public controls and removable active state', () => {
  const state = {
    ...createDefaultFilterState(),
    search: 'spectron',
    weapons: ['FAMAS'],
    stattrak: true,
    floatMin: 0.01,
  };
  const html = renderFilters(state, options, false);

  assert.match(html, /type="search"/);
  assert.match(html, /name="weapon"/);
  assert.match(html, /name="collection"/);
  assert.match(html, /name="case"/);
  assert.match(html, /name="source_type"/);
  assert.match(html, /name="rarity"/);
  assert.match(html, /name="wear"/);
  assert.match(html, /name="stattrak"/);
  assert.match(html, /name="souvenir"/);
  assert.match(html, /name="float_min"/);
  assert.match(html, /data-action="remove-filter"/);
  assert.match(html, /data-action="clear-filters"/);
  assert.match(html, /FAMAS/);
  assert.match(html, /StatTrak™ available/);
});

test('skin card follows approved structure without inventing prices or actions', () => {
  const html = renderResults({
    items: [skin],
    total: 1,
    state: createDefaultFilterState(),
    selectedId: null,
    loading: false,
    error: null,
  });

  assert.match(html, /Collection &gt; Skins/);
  assert.match(html, /FAMAS \| ZX Spectron/);
  assert.match(html, /Restricted/);
  assert.match(html, />FN</);
  assert.match(html, />MW</);
  assert.match(html, /Operation Riptide Case/);
  assert.match(html, /The Falchion Collection/);
  assert.match(html, /SkinRush/);
  assert.doesNotMatch(html, /src=""/);
  assert.doesNotMatch(html, /£|\$|Buy|affiliate/i);
});

test('selected card inserts a structural authoritative expanded panel', () => {
  const html = renderResults({
    items: [skin],
    total: 1,
    state: createDefaultFilterState(),
    selectedId: skin.id,
    loading: false,
    error: null,
  });

  assert.match(html, /data-expanded-for="famas_zx_spectron"/);
  assert.match(html, /A custom painted FAMAS finish\./);
  assert.match(html, /0\.00–0\.90/);
  assert.doesNotMatch(html, /Purchase|Trade-up|Steam login/i);
});

test('results preserve cards during loading and expose loading, empty, and error states', () => {
  const loading = renderResults({
    items: [skin], total: 1, state: createDefaultFilterState(), selectedId: null,
    loading: true, error: null,
  });
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /FAMAS \| ZX Spectron/);
  assert.match(loading, /Updating skins/);

  const empty = renderResults({
    items: [], total: 0, state: createDefaultFilterState(), selectedId: null,
    loading: false, error: null,
  });
  assert.match(empty, /No skins match these filters/);
  assert.match(empty, /data-action="clear-filters"/);

  const error = renderResults({
    items: [], total: 0, state: createDefaultFilterState(), selectedId: null,
    loading: false, error: 'API unavailable',
  });
  assert.match(error, /role="alert"/);
  assert.match(error, /API unavailable/);
  assert.match(error, /data-action="retry"/);
});

test('widget CSS uses container-driven grid adaptation without a phone breakpoint', () => {
  const cssPath = path.resolve(
    'src/site/widgets/custom-elements/skinrush-skin-database/element.module.css',
  );
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(css, /#0A0014/i);
  assert.match(css, /#00F0FF/i);
  assert.match(css, /repeat\(auto-fit,\s*minmax\(/i);
  assert.match(css, /overflow-x:\s*auto/i);
  assert.doesNotMatch(css, /@media/i);
});
