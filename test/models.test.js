import assert from 'node:assert/strict';
import { before, test } from 'node:test';

let Collection;
let Skin;
let SkinCollection;

before(async () => {
  process.env.DATABASE_URL = 'postgres://user:password@localhost:5432/skinrush_test';
  ({ Collection, Skin, SkinCollection } = await import('../models/associations.js'));
});

test('skin identifiers use the string values supplied by the database export', () => {
  assert.equal(Skin.tableName, 'skins');
  assert.equal(Skin.rawAttributes.id.field, 'skin_id');
  assert.equal(Skin.rawAttributes.id.type.key, 'STRING');
});

test('collection fields map to the existing collections table', () => {
  assert.equal(Collection.tableName, 'collections');
  assert.equal(Collection.rawAttributes.id.field, 'collection_id');
  assert.equal(Collection.rawAttributes.id.type.key, 'STRING');
  assert.equal(Collection.rawAttributes.name.field, 'collection_name');
  assert.equal(Collection.rawAttributes.isActive.field, 'is_active');
});

test('skin collection links use a composite string key', () => {
  assert.equal(SkinCollection.tableName, 'skin_collections');
  assert.equal(SkinCollection.rawAttributes.skinId.type.key, 'STRING');
  assert.equal(SkinCollection.rawAttributes.collectionId.type.key, 'STRING');
  assert.equal(SkinCollection.rawAttributes.skinId.primaryKey, true);
  assert.equal(SkinCollection.rawAttributes.collectionId.primaryKey, true);
});

test('skins and collections expose the many-to-many relationship', () => {
  assert.equal(Skin.associations.collections.target, Collection);
  assert.equal(Collection.associations.skins.target, Skin);
  assert.equal(Skin.associations.collections.through.model, SkinCollection);
});

