import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CollectionQueryError,
  parseCollectionQuery
} from '../collections/query.js';

test('collection query defaults support the first browse page', () => {
  assert.deepEqual(parseCollectionQuery({}), {
    search: null,
    active: null,
    limit: 24,
    offset: 0
  });
});

test('collection query trims search and parses explicit values', () => {
  assert.deepEqual(parseCollectionQuery({
    search: '  falchion  ',
    active: 'false',
    limit: '50',
    offset: '25'
  }), {
    search: 'falchion',
    active: false,
    limit: 50,
    offset: 25
  });
});

test('an empty search behaves like an omitted search', () => {
  assert.equal(parseCollectionQuery({ search: '   ' }).search, null);
});

for (const [field, value] of [
  ['active', 'yes'],
  ['limit', '0'],
  ['limit', '101'],
  ['limit', '2.5'],
  ['offset', '-1'],
  ['offset', 'later']
]) {
  test(`collection query rejects invalid ${field} value ${value}`, () => {
    assert.throws(
      () => parseCollectionQuery({ [field]: value }),
      error => error instanceof CollectionQueryError
        && error.code === 'INVALID_QUERY'
        && error.field === field
    );
  });
}

