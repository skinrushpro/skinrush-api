import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CollectionNotFoundError,
  createCollectionService
} from '../collections/service.js';

function collection(overrides = {}) {
  return {
    id: 'the_falchion_collection',
    name: 'The Falchion Collection',
    releaseDate: null,
    sourceType: 'NULL',
    operationName: 'NULL',
    isActive: true,
    skins: [],
    ...overrides
  };
}

test('list returns collection summaries, rarity counts, and pagination', async () => {
  const Collection = {
    async findAndCountAll() {
      return {
        count: 35,
        rows: [collection({
          skins: [
            { id: 'skin-1', rarity: 'Mil-Spec Grade' },
            { id: 'skin-2', rarity: 'Restricted' },
            { id: 'skin-3', rarity: 'Mil-Spec Grade' }
          ]
        })]
      };
    }
  };
  const service = createCollectionService({ Collection, Skin: {} });

  const result = await service.list({
    search: null,
    active: true,
    limit: 24,
    offset: 0
  });

  assert.deepEqual(result, {
    items: [{
      id: 'the_falchion_collection',
      slug: 'the_falchion_collection',
      name: 'The Falchion Collection',
      releaseDate: null,
      sourceType: null,
      operationName: null,
      isActive: true,
      skinCount: 3,
      rarityBreakdown: {
        'Mil-Spec Grade': 2,
        Restricted: 1
      }
    }],
    pagination: {
      limit: 24,
      offset: 0,
      total: 35
    }
  });
});

test('detail returns linked skins in Valve rarity order then by name', async () => {
  const Collection = {
    async findByPk() {
      return collection({
        skins: [
          { id: 'skin-3', name: 'Zebra', weapon: 'FAMAS', rarity: 'Restricted' },
          { id: 'skin-2', name: 'Amber', weapon: 'FAMAS', rarity: 'Mil-Spec Grade' },
          { id: 'skin-1', name: 'Azure', weapon: 'FAMAS', rarity: 'Restricted' }
        ]
      });
    }
  };
  const service = createCollectionService({ Collection, Skin: {} });

  const result = await service.getBySlug('the_falchion_collection');

  assert.deepEqual(result.skins.map(skin => skin.id), ['skin-2', 'skin-1', 'skin-3']);
  assert.equal(result.skinCount, 3);
  assert.deepEqual(result.rarityBreakdown, {
    'Mil-Spec Grade': 1,
    Restricted: 2
  });
});

test('detail reports an unknown collection with a typed error', async () => {
  const Collection = { findByPk: async () => null };
  const service = createCollectionService({ Collection, Skin: {} });

  await assert.rejects(
    service.getBySlug('missing_collection'),
    error => error instanceof CollectionNotFoundError
      && error.code === 'COLLECTION_NOT_FOUND'
  );
});

