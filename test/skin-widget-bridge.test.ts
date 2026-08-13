import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createResultsBridgeEvent,
  createResultsBridgePayload,
  dispatchSkinrushCommand,
  parseSkinrushCommand,
  parseResultsBridgePayload,
  skinIdToRepeaterId,
} from '../src/site/widgets/custom-elements/skinrush-skin-database/bridge-contract';
import { createDefaultFilterState } from '../src/site/widgets/custom-elements/skinrush-skin-database/filter-state';
import type { ControllerSnapshot } from '../src/site/widgets/custom-elements/skinrush-skin-database/controller';
import type { SkinResult } from '../src/site/widgets/custom-elements/skinrush-skin-database/types';

const skin: SkinResult = {
  id: 'famas_zx_spectron',
  name: 'ZX Spectron',
  weapon: 'FAMAS',
  rarity: 'Restricted',
  rarityColor: '#8847ff',
  category: 'Rifle',
  min_float: 0.01,
  max_float: 0.9,
  stattrak: true,
  souvenir: false,
  image: ' https://cdn.example.test/famas.png ',
  phase: null,
  description: null,
  collections: [{ id: 'riptide_collection', name: 'The Riptide Collection' }],
  cases: [{ id: 'operation_riptide_case', name: 'Operation Riptide Case', sourceType: 'Case' }],
  availableWears: ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'],
};

function snapshot(items: SkinResult[] = [skin]): ControllerSnapshot {
  return {
    state: createDefaultFilterState(),
    options: { weapons: [], collections: [], cases: [], sourceTypes: [], rarities: [], wears: [] },
    items,
    total: items.length,
    loading: false,
    error: null,
    selectedId: skin.id,
  };
}

test('bridge payload maps authoritative card data and a Wix-safe stable ID', () => {
  const payload = createResultsBridgePayload(snapshot(), 7);

  assert.deepEqual(payload, {
    version: 1,
    revision: 7,
    items: [{
      _id: skinIdToRepeaterId('famas_zx_spectron'),
      skinId: 'famas_zx_spectron',
      title: 'FAMAS | ZX Spectron',
      rarityColor: '#8847ff',
      stattrak: true,
      souvenir: false,
      wearSpan: 'Factory New → Battle-Scarred',
      floatMin: 0.01,
      floatMax: 0.9,
      floatRange: '0.01–0.90',
      artworkUrl: 'https://cdn.example.test/famas.png',
      source: {
        text: 'Operation Riptide Case',
        action: { kind: 'case', id: 'operation_riptide_case' },
        linkedNames: ['Operation Riptide Case'],
      },
    }],
    total: 1,
    loading: false,
    error: null,
    selectedSkinId: 'famas_zx_spectron',
  });
  assert.match(payload.items[0]._id, /^[A-Za-z0-9-]+$/);
  assert.notEqual(skinIdToRepeaterId('a_b'), skinIdToRepeaterId('a-b'));
});

test('bridge derives conservative source presentation without selecting a primary relationship', () => {
  const multipleCases = createResultsBridgePayload(snapshot([{
    ...skin,
    cases: [
      { id: 'case-a', name: 'Case A', sourceType: 'Case' },
      { id: 'case-b', name: 'Case B', sourceType: 'Case' },
    ],
  }]), 1).items[0];
  assert.deepEqual(multipleCases.source, {
    text: 'Multiple sources', action: null, linkedNames: ['Case A', 'Case B'],
  });

  const oneCollection = createResultsBridgePayload(snapshot([{
    ...skin, cases: [], collections: [{ id: 'collection-a', name: 'Collection A' }],
  }]), 2).items[0];
  assert.deepEqual(oneCollection.source, {
    text: 'Collection A',
    action: { kind: 'collection', id: 'collection-a' },
    linkedNames: ['Collection A'],
  });

  const multipleCollections = createResultsBridgePayload(snapshot([{
    ...skin,
    cases: [],
    collections: [
      { id: 'collection-a', name: 'Collection A' },
      { id: 'collection-b', name: 'Collection B' },
    ],
  }]), 3).items[0];
  assert.deepEqual(multipleCollections.source, {
    text: 'Multiple collections', action: null, linkedNames: ['Collection A', 'Collection B'],
  });

  const missing = createResultsBridgePayload(snapshot([{ ...skin, cases: [], collections: [] }]), 4).items[0];
  assert.deepEqual(missing.source, {
    text: 'Source unavailable', action: null, linkedNames: [],
  });
});

test('bridge payload validation rejects malformed repeater data', () => {
  const valid = createResultsBridgePayload(snapshot(), 1);
  assert.deepEqual(parseResultsBridgePayload(valid), valid);
  assert.equal(parseResultsBridgePayload({ ...valid, revision: -1 }), null);
  assert.equal(parseResultsBridgePayload({ ...valid, items: [{ ...valid.items[0], _id: 'bad_id' }] }), null);
  assert.equal(parseResultsBridgePayload({ ...valid, items: [{ ...valid.items[0], source: { text: 'Case', action: { kind: 'case' } } }] }), null);
});

test('command validation accepts only supported complete commands', () => {
  assert.deepEqual(parseSkinrushCommand(JSON.stringify({
    type: 'select-skin', skinId: 'famas_zx_spectron', revision: 1,
  })), {
    type: 'select-skin', skinId: 'famas_zx_spectron', revision: 1,
  });
  assert.deepEqual(parseSkinrushCommand(JSON.stringify({
    type: 'apply-source-filter', sourceKind: 'collection', sourceId: 'riptide_collection', revision: 2,
  })), {
    type: 'apply-source-filter', sourceKind: 'collection', sourceId: 'riptide_collection', revision: 2,
  });

  for (const malformed of [
    '',
    '{',
    JSON.stringify({ type: 'select-skin', skinId: '', revision: 1 }),
    JSON.stringify({ type: 'select-skin', skinId: 'skin', revision: -1 }),
    JSON.stringify({ type: 'apply-source-filter', sourceKind: 'weapon', sourceId: 'ak-47', revision: 2 }),
    JSON.stringify({ type: 'unknown', revision: 3 }),
  ]) {
    assert.equal(parseSkinrushCommand(malformed), null);
  }
});

test('result events expose validated payloads across the custom-element boundary', () => {
  const payload = createResultsBridgePayload(snapshot(), 9);
  const event = createResultsBridgeEvent(payload);

  assert.equal(event.type, 'skinrush-results-change');
  assert.equal(event.bubbles, true);
  assert.equal(event.composed, true);
  assert.deepEqual(event.detail, payload);
});

test('commands route only newer validated revisions into the existing controller', () => {
  const calls: unknown[] = [];
  const controller = {
    select: (skinId: string) => calls.push(['select', skinId]),
    applySourceFilter: (kind: 'case' | 'collection', sourceId: string) => (
      calls.push(['source', kind, sourceId])
    ),
  };

  assert.equal(dispatchSkinrushCommand(controller, JSON.stringify({
    type: 'select-skin', skinId: 'skin-a', revision: 4,
  }), 3), 4);
  assert.equal(dispatchSkinrushCommand(controller, JSON.stringify({
    type: 'select-skin', skinId: 'skin-a', revision: 4,
  }), 4), 4);
  assert.equal(dispatchSkinrushCommand(controller, JSON.stringify({
    type: 'select-skin', skinId: 'skin-a', revision: 5,
  }), 4), 5);
  assert.equal(dispatchSkinrushCommand(controller, JSON.stringify({
    type: 'apply-source-filter', sourceKind: 'case', sourceId: 'case-a', revision: 6,
  }), 5), 6);
  assert.equal(dispatchSkinrushCommand(controller, '{', 6), 6);

  assert.deepEqual(calls, [
    ['select', 'skin-a'],
    ['select', 'skin-a'],
    ['source', 'case', 'case-a'],
  ]);
});
