import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { createApp } from '../app.js';

const servers = new Set();

afterEach(async () => {
  await Promise.all(
    [...servers].map(server => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }))
  );
  servers.clear();
});

async function startApp(options = {}) {
  const server = createApp(options).listen(0);
  servers.add(server);

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

test('GET /api/hello returns the backend health message', async () => {
  const baseUrl = await startApp();

  const response = await fetch(`${baseUrl}/api/hello`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { message: 'Backend is working!' });
});

for (const origin of [
  'https://www.skinrush.pro',
  'https://editor.wix.com',
  'https://preview.wixsite.com',
  'http://localhost:5173',
  'http://localhost:5174'
]) {
  test(`CORS allows ${origin}`, async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/api/hello`, {
      headers: { Origin: origin }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
}

test('CORS omits allow-origin for unknown browser origins', async () => {
  const baseUrl = await startApp();
  const response = await fetch(`${baseUrl}/api/hello`, {
    headers: { Origin: 'https://attacker.example' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('CORS preflight uses the Wix allowlist', async () => {
  const baseUrl = await startApp();
  const response = await fetch(`${baseUrl}/api/collections`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://editor.wix.com',
      'Access-Control-Request-Method': 'GET'
    }
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://editor.wix.com'
  );
});

test('GET /api/test-db reports database availability', async () => {
  const sequelize = { authenticate: async () => {} };
  const baseUrl = await startApp({ sequelize });
  const response = await fetch(`${baseUrl}/api/test-db`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: 'Database connected successfully'
  });
});

test('GET /api/test-db hides database failure details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const sequelize = {
    authenticate: async () => {
      throw new Error('database "private_name" does not exist');
    }
  };
  const baseUrl = await startApp({ sequelize });
  const response = await fetch(`${baseUrl}/api/test-db`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Database unavailable'
  });
});

test('GET /api/skins hides ORM failure details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const skinService = {
    legacyList: async () => {
      throw new Error('relation private_schema.skins does not exist');
    }
  };
  const baseUrl = await startApp({ skinService });
  const response = await fetch(`${baseUrl}/api/skins`);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch skins' });
});

test('GET /api/skins preserves the legacy unfiltered array response', async () => {
  const expected = [{ id: 'skin-legacy' }];
  let calls = 0;
  const skinService = {
    async legacyList() {
      calls += 1;
      return expected;
    }
  };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(`${baseUrl}/api/skins`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
  assert.equal(response.headers.get('x-total-count'), null);
  assert.equal(calls, 1);
});

test('filtered skins remain an array and expose total count cross-origin', async () => {
  let receivedQuery;
  const skinService = {
    async search(query) {
      receivedQuery = query;
      return { items: [{ id: 'skin-1' }], total: 1475 };
    }
  };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(`${baseUrl}/api/skins?weapon=AK-47`, {
    headers: { Origin: 'https://www.skinrush.pro' }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ id: 'skin-1' }]);
  assert.equal(response.headers.get('x-total-count'), '1475');
  assert.match(
    response.headers.get('access-control-expose-headers') || '',
    /X-Total-Count/i
  );
  assert.deepEqual(receivedQuery.weapons, ['AK-47']);
  assert.equal(receivedQuery.limit, 25);
  assert.equal(receivedQuery.offset, 0);
});

test('GET /api/skins preserves false Boolean filters', async () => {
  let receivedQuery;
  const skinService = {
    async search(query) {
      receivedQuery = query;
      return { items: [], total: 0 };
    }
  };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(
    `${baseUrl}/api/skins?stattrak=false&souvenir=false`
  );

  assert.equal(response.status, 200);
  assert.equal(receivedQuery.stattrak, false);
  assert.equal(receivedQuery.souvenir, false);
});

test('GET /api/skins/filters returns authoritative filter options', async () => {
  const expected = { weapons: ['AK-47'], wears: [] };
  const skinService = { filterOptions: async () => expected };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(`${baseUrl}/api/skins/filters`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
});

test('GET /api/skins rejects malformed query values', async () => {
  const skinService = { search: async () => assert.fail('service must not run') };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(`${baseUrl}/api/skins?wear=Pristine`);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVALID_QUERY',
      field: 'wear',
      message: 'wear contains an unsupported value: Pristine'
    }
  });
});

test('filtered GET /api/skins hides service failure details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const skinService = {
    async search() {
      throw new Error('password authentication failed for private_user');
    }
  };
  const baseUrl = await startApp({ skinService });

  const response = await fetch(`${baseUrl}/api/skins?limit=1`);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch skins' });
});

test('POST /api/skins/filter preserves the legacy weapon filter', async () => {
  let recorded;
  const sequelize = {
    async query(sql, options) {
      recorded = { sql, options };
      return [[{ id: 'skin-1' }]];
    }
  };
  const skinService = { legacyList: async () => [] };
  const baseUrl = await startApp({ sequelize, skinService });

  const response = await fetch(`${baseUrl}/api/skins/filter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weapon: 'AK-47' })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ id: 'skin-1' }]);
  assert.match(recorded.sql, /WHERE weapon_name = :weapon/);
  assert.deepEqual(recorded.options.replacements, { weapon: 'AK-47' });
});

test('GET /api/collections returns the service result with parsed query values', async () => {
  let receivedQuery;
  const expected = {
    items: [],
    pagination: { limit: 10, offset: 5, total: 0 }
  };
  const collectionService = {
    async list(query) {
      receivedQuery = query;
      return expected;
    }
  };
  const baseUrl = await startApp({ collectionService });

  const response = await fetch(
    `${baseUrl}/api/collections?search=falchion&active=true&limit=10&offset=5`
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
  assert.deepEqual(receivedQuery, {
    search: 'falchion',
    active: true,
    limit: 10,
    offset: 5
  });
});

test('GET /api/collections rejects malformed query values', async () => {
  const collectionService = { list: async () => assert.fail('service must not run') };
  const baseUrl = await startApp({ collectionService });

  const response = await fetch(`${baseUrl}/api/collections?limit=0`);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVALID_QUERY',
      field: 'limit',
      message: 'limit must be between 1 and 100'
    }
  });
});

test('GET /api/collections/:slug returns collection detail', async () => {
  const expected = { id: 'the_falchion_collection', skins: [] };
  const collectionService = { getBySlug: async () => expected };
  const baseUrl = await startApp({ collectionService });

  const response = await fetch(`${baseUrl}/api/collections/the_falchion_collection`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), expected);
});

test('GET /api/collections/:slug returns a stable not-found error', async () => {
  const collectionService = {
    async getBySlug() {
      throw Object.assign(new Error('missing'), { code: 'COLLECTION_NOT_FOUND' });
    }
  };
  const baseUrl = await startApp({ collectionService });

  const response = await fetch(`${baseUrl}/api/collections/missing_collection`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'COLLECTION_NOT_FOUND',
      message: 'Collection not found'
    }
  });
});
