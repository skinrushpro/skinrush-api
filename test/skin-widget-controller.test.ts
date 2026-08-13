import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SkinWidgetController,
  findRowEndIndex,
  type ControllerSnapshot,
} from '../src/site/widgets/custom-elements/skinrush-skin-database/controller';
import { createDefaultFilterState } from '../src/site/widgets/custom-elements/skinrush-skin-database/filter-state';
import type { FilterOptions, FilterState, SkinPage } from '../src/site/widgets/custom-elements/skinrush-skin-database/types';

const options: FilterOptions = {
  weapons: [], collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness() {
  const searches: Array<{ state: FilterState; signal: AbortSignal; result: ReturnType<typeof deferred<SkinPage>> }> = [];
  const snapshots: ControllerSnapshot[] = [];
  let params = new URLSearchParams('campaign=summer');
  let popHandler: (() => void) | null = null;
  let timer: (() => void) | null = null;

  const controller = new SkinWidgetController({
    api: {
      loadOptions: async () => options,
      search: (state, signal) => {
        const result = deferred<SkinPage>();
        searches.push({ state: structuredClone(state), signal, result });
        return result.promise;
      },
    },
    history: {
      read: () => new URLSearchParams(params),
      push: next => { params = new URLSearchParams(next); },
      subscribe: handler => { popHandler = handler; return () => { popHandler = null; }; },
    },
    scheduler: {
      set: callback => { timer = callback; return 1; },
      clear: () => { timer = null; },
    },
    onChange: snapshot => snapshots.push(structuredClone(snapshot)),
  });

  return {
    controller, searches, snapshots,
    params: () => params,
    setParams: (next: string) => { params = new URLSearchParams(next); },
    pop: () => popHandler?.(),
    flushTimer: () => { const callback = timer; timer = null; callback?.(); },
    hasTimer: () => timer !== null,
  };
}

test('connect loads options and the URL-restored first page', async () => {
  const h = harness();
  h.setParams('campaign=summer&weapon=FAMAS');
  h.controller.connect();
  await Promise.resolve();

  assert.equal(h.searches.length, 1);
  assert.deepEqual(h.searches[0].state.weapons, ['FAMAS']);
  h.searches[0].result.resolve({ items: [], total: 0 });
  await Promise.resolve();
  assert.deepEqual(h.snapshots.at(-1)?.options, options);
});

test('immediate changes request now while search changes debounce for 300 ms', () => {
  const h = harness();
  h.controller.connect();
  assert.equal(h.searches.length, 1);

  h.controller.update({ weapons: ['AK-47'] }, false);
  assert.equal(h.searches.length, 2);

  h.controller.update({ search: 'asiimov' }, true);
  assert.equal(h.searches.length, 2);
  assert.equal(h.hasTimer(), true);
  h.flushTimer();
  assert.equal(h.searches.length, 3);
  assert.equal(h.searches[2].state.search, 'asiimov');
});

test('new requests abort old requests and stale responses cannot overwrite results', async () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ weapons: ['FAMAS'] }, false);

  assert.equal(h.searches[0].signal.aborted, true);
  h.searches[1].result.resolve({ items: [], total: 2 });
  await Promise.resolve();
  h.searches[0].result.resolve({ items: [], total: 99 });
  await Promise.resolve();
  assert.equal(h.snapshots.at(-1)?.total, 2);
});

test('popstate restores filters and clear preserves unrelated URL parameters', () => {
  const h = harness();
  h.controller.connect();
  h.setParams('campaign=summer&rarity=Covert');
  h.pop();
  assert.deepEqual(h.searches.at(-1)?.state.rarities, ['Covert']);

  h.controller.clear();
  assert.equal(h.params().get('campaign'), 'summer');
  assert.equal(h.params().has('rarity'), false);
});

test('pagination writes a bounded offset and requests the selected page', () => {
  const h = harness();
  h.controller.connect();
  h.controller.goToOffset(25);

  assert.equal(h.params().get('offset'), '25');
  assert.equal(h.searches.at(-1)?.state.offset, 25);
});

test('source commands use the existing filter and history request pipeline', () => {
  const h = harness();
  h.controller.connect();

  h.controller.applySourceFilter('case', 'operation_riptide_case');
  assert.deepEqual(h.searches.at(-1)?.state.cases, ['operation_riptide_case']);
  assert.deepEqual(h.searches.at(-1)?.state.collections, []);
  assert.equal(h.params().get('case'), 'operation_riptide_case');

  h.controller.applySourceFilter('collection', 'riptide_collection');
  assert.deepEqual(h.searches.at(-1)?.state.collections, ['riptide_collection']);
  assert.deepEqual(h.searches.at(-1)?.state.cases, ['operation_riptide_case']);
  assert.equal(h.params().get('collection'), 'riptide_collection');
});

test('disconnect cancels debounce, aborts requests, and removes popstate listener', () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ search: 'dragon' }, true);
  h.controller.disconnect();

  assert.equal(h.hasTimer(), false);
  assert.equal(h.searches[0].signal.aborted, true);
  const count = h.searches.length;
  h.pop();
  assert.equal(h.searches.length, count);
});

test('row insertion follows measured card tops instead of a hard-coded column count', () => {
  assert.equal(findRowEndIndex([10, 10, 10, 220, 220], 1), 2);
  assert.equal(findRowEndIndex([10, 10, 220, 220, 430], 3), 3);
  assert.equal(findRowEndIndex([10, 10], 9), -1);
});
