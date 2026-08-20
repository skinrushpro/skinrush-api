import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const adapterPath = new URL('../docs/wix/skin-database-page-adapter.js', import.meta.url);
const adapterSource = fs.readFileSync(adapterPath, 'utf8');

function harness() {
  let readyHandler = null;
  let resultHandler = null;
  let onItemReady = null;
  const attributes = [];
  const calls = [];
  const repeated = new Map();
  const timers = [];

  function element(id) {
    return {
      id,
      text: '', src: '', alt: '', accessibility: {},
      collapse: () => calls.push(['collapse', id]),
      expand: () => calls.push(['expand', id]),
      onClick(handler) { this.click = handler; },
      click: null,
    };
  }

  function itemSelector(itemData) {
    if (!repeated.has(itemData._id)) repeated.set(itemData._id, new Map());
    const elements = repeated.get(itemData._id);
    return id => {
      if (!elements.has(id)) elements.set(id, element(id));
      return elements.get(id);
    };
  }

  const repeater = {
    _data: [],
    set data(items) {
      this._data = items;
      for (const item of items) onItemReady?.(itemSelector(item), item);
    },
    get data() { return this._data; },
    onItemReady(handler) { onItemReady = handler; },
    forEachItem(handler) {
      for (const item of this._data) handler(itemSelector(item), item);
    },
  };
  const customElement = {
    on(name, handler) {
      assert.equal(name, 'skinrush-results-change');
      resultHandler = handler;
    },
    setAttribute(name, value) { attributes.push([name, value]); },
  };
  function $w(selector) {
    if (selector === '#skinDatabaseCardsRepeater') return repeater;
    if (selector === '#skinRushSkinDatabase1') return customElement;
    throw new Error(`Unexpected selector ${selector}`);
  }
  $w.onReady = handler => { readyHandler = handler; };

  vm.runInNewContext(adapterSource, {
    $w, JSON, Number, Set,
    setTimeout: handler => { timers.push(handler); return timers.length; },
  }, { filename: adapterPath.pathname });
  readyHandler();

  return {
    attributes, calls, repeater, repeated,
    emit: detail => resultHandler({ detail }),
    flushTimers: () => { while (timers.length) timers.shift()(); },
  };
}

const item = {
  _id: 'skin-00006600006100006d000061000073',
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
};

function payload(overrides = {}) {
  return {
    version: 1, revision: 1, items: [item], total: 1,
    loading: false, error: null, selectedSkinId: null,
    ...overrides,
  };
}

test('Wix adapter binds authoritative native fields and collapses unsupported elements', () => {
  const h = harness();
  h.emit(payload());
  const elements = h.repeated.get(item._id);

  assert.equal(h.repeater.data[0]._id, item._id);
  assert.equal(elements.get('#weaponNameTitle').text, 'FAMAS | ZX Spectron');
  assert.equal(elements.get('#rarityRange').text, 'Factory New → Battle-Scarred');
  assert.equal(elements.get('#floatNumber').text, '0.01–0.90');
  assert.equal(elements.get('#caseName').text, 'Operation Riptide Case');
  assert.equal(elements.get('#weaponImage').src, 'https://cdn.example.test/famas.png');
  assert.ok(h.calls.some(call => call[0] === 'collapse' && call[1] === '#armouryIcon'));
  assert.ok(h.calls.some(call => call[0] === 'collapse' && call[1] === '#tradeUpSignalIcon'));
  assert.ok(h.calls.some(call => call[0] === 'collapse' && call[1] === '#souvenirIcon'));
  assert.ok(h.calls.some(call => call[0] === 'collapse' && call[1] === '#marketPriceStack'));
  assert.ok(h.calls.some(call => call[0] === 'expand' && call[1] === '#stattrakIcon'));
});

test('Wix adapter sends revised selection and authoritative source commands', () => {
  const h = harness();
  h.emit(payload());
  const elements = h.repeated.get(item._id);

  elements.get('#mainCardContainer').click();
  elements.get('#mainCardContainer').click();
  elements.get('#caseNameContainer').click();
  elements.get('#mainCardContainer').click();

  const commands = h.attributes.map(([, value]) => JSON.parse(value));
  assert.deepEqual(commands, [
    { type: 'select-skin', skinId: item.skinId, revision: 1 },
    { type: 'select-skin', skinId: item.skinId, revision: 2 },
    {
      type: 'apply-source-filter', sourceKind: 'case',
      sourceId: 'operation_riptide_case', revision: 3,
    },
  ]);
});

test('Wix adapter attaches handlers once and uses the latest source action', () => {
  const h = harness();
  h.emit(payload());
  h.emit(payload({
    revision: 2,
    items: [{
      ...item,
      source: {
        text: 'The Riptide Collection',
        action: { kind: 'collection', id: 'riptide_collection' },
        linkedNames: ['The Riptide Collection'],
      },
    }],
  }));
  const elements = h.repeated.get(item._id);
  elements.get('#caseNameContainer').click();
  elements.get('#mainCardContainer').click();
  h.flushTimers();
  elements.get('#mainCardContainer').click();

  assert.deepEqual(h.attributes.map(([, value]) => JSON.parse(value)), [
    {
      type: 'apply-source-filter', sourceKind: 'collection',
      sourceId: 'riptide_collection', revision: 1,
    },
    { type: 'select-skin', skinId: item.skinId, revision: 2 },
  ]);
});

test('Wix adapter ignores malformed payloads and refreshes retained repeater items', () => {
  const h = harness();
  h.emit(payload());
  h.emit({ ...payload(), items: [{ ...item, _id: 'bad_id' }] });
  assert.equal(h.repeater.data[0]._id, item._id);

  h.emit(payload({
    revision: 2,
    selectedSkinId: item.skinId,
    items: [{ ...item, floatRange: '0.02–0.80', stattrak: false, souvenir: true }],
  }));
  const elements = h.repeated.get(item._id);
  assert.equal(elements.get('#floatNumber').text, '0.02–0.80');
  assert.equal(elements.get('#mainCardContainer').accessibility.ariaPressed, true);
  assert.ok(h.calls.some(call => call[0] === 'collapse' && call[1] === '#stattrakIcon'));
  assert.ok(h.calls.some(call => call[0] === 'expand' && call[1] === '#souvenirIcon'));
});

test('Wix adapter contains no database request implementation', () => {
  assert.doesNotMatch(adapterSource, /\bfetch\s*\(|\/api\/skins|XMLHttpRequest|axios/i);
});
