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
  'https://preview.wixsite.com'
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
  const Skin = {
    findAll: async () => {
      throw new Error('relation private_schema.skins does not exist');
    }
  };
  const baseUrl = await startApp({ Skin });
  const response = await fetch(`${baseUrl}/api/skins`);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch skins' });
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
