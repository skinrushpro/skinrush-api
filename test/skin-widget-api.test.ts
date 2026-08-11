import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SkinApiClient,
  SkinApiError,
} from '../src/site/widgets/custom-elements/skinrush-skin-database/api.ts';
import { createDefaultFilterState } from '../src/site/widgets/custom-elements/skinrush-skin-database/filter-state.ts';

test('filter options are requested from the configured API', async () => {
  let requestedUrl = '';
  const expected = {
    weapons: ['AK-47'],
    collections: [],
    cases: [],
    sourceTypes: [],
    rarities: [],
    wears: [],
  };
  const client = new SkinApiClient('https://api.example.test/', async input => {
    requestedUrl = String(input);
    return Response.json(expected);
  });

  assert.deepEqual(await client.loadOptions(), expected);
  assert.equal(requestedUrl, 'https://api.example.test/api/skins/filters');
});

test('search requests a bounded array page and reads X-Total-Count', async () => {
  let requestedUrl = '';
  let receivedSignal: AbortSignal | null | undefined;
  const controller = new AbortController();
  const client = new SkinApiClient('https://api.example.test', async (input, init) => {
    requestedUrl = String(input);
    receivedSignal = init?.signal;
    return Response.json([{ id: 'skin-1' }], {
      headers: { 'X-Total-Count': '1475' },
    });
  });
  const state = {
    ...createDefaultFilterState(),
    weapons: ['AK-47', 'AWP'],
  };

  const result = await client.search(state, controller.signal);

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, '/api/skins');
  assert.equal(url.searchParams.get('weapon'), 'AK-47,AWP');
  assert.equal(url.searchParams.get('limit'), '25');
  assert.equal(receivedSignal, controller.signal);
  assert.deepEqual(result, { items: [{ id: 'skin-1' }], total: 1475 });
});

test('search rejects a non-array body without exposing response details', async () => {
  const client = new SkinApiClient('https://api.example.test', async () => (
    Response.json({ items: [] }, { headers: { 'X-Total-Count': '0' } })
  ));

  await assert.rejects(
    client.search(createDefaultFilterState(), new AbortController().signal),
    error => error instanceof SkinApiError
      && error.message === 'The skin database returned an unexpected response.',
  );
});

test('search rejects a missing or invalid total count', async () => {
  for (const total of [null, '-1', '2.5', 'later']) {
    const client = new SkinApiClient('https://api.example.test', async () => {
      const headers = new Headers();
      if (total !== null) headers.set('X-Total-Count', total);
      return Response.json([], { headers });
    });

    await assert.rejects(
      client.search(createDefaultFilterState(), new AbortController().signal),
      error => error instanceof SkinApiError
        && error.message === 'The skin database returned an unexpected response.',
    );
  }
});

test('API failures use a stable public-safe error', async () => {
  const client = new SkinApiClient('https://api.example.test', async () => (
    Response.json({ error: 'private database detail' }, { status: 503 })
  ));

  await assert.rejects(
    client.loadOptions(),
    error => error instanceof SkinApiError
      && error.message === 'The skin database is temporarily unavailable.',
  );
});

test('aborts are preserved and distinguished from API failures', async () => {
  const abort = new DOMException('The operation was aborted.', 'AbortError');
  const controller = new AbortController();
  const client = new SkinApiClient('https://api.example.test', async (_input, init) => {
    assert.equal(init?.signal, controller.signal);
    throw abort;
  });

  await assert.rejects(
    client.search(createDefaultFilterState(), controller.signal),
    error => error === abort,
  );
});

