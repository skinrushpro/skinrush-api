# SkinRush Card, Multi-Select, and Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the SkinRush database cards to the approved visual hierarchy, replace six single-select filters with accessible checkbox popovers, and add deterministic server-side sorting with URL/history restoration.

**Architecture:** Extend the existing `/api/skins` parser and service with a typed sort allowlist and fixed SQL ordering before pagination. Extend the existing frontend `FilterState` and controller rather than creating parallel state, then keep rendering split between filter controls and result cards. Extract focused card/source/description helpers so the existing render modules stay reviewable while the React custom element retains delegated events and stale-request protection.

**Tech Stack:** Node.js 22, Express 4, Sequelize 6, PostgreSQL, TypeScript, React 16, `react-to-webcomponent`, CSS Modules, Wix CLI 1.1.236, Node test runner with `tsx`.

## Global Constraints

- The committed design at `docs/superpowers/specs/2026-08-13-skin-card-filters-sort-design.md` is authoritative; do not make further product or design decisions during implementation.
- Keep the existing `/api/skins` array response and `X-Total-Count` header; do not add a sorted-results endpoint or JSON envelope.
- Sort on the backend before `LIMIT` and `OFFSET`; never sort only the current browser page.
- Use fixed sort and rarity SQL allowlists; never concatenate raw URL input as a column or direction.
- Preserve filter API compatibility, unrelated URL parameters, browser history, pagination, request cancellation, stale-response protection, and loading/empty/error states.
- Display no Steam price, Steam icon, price placeholder, case image, case-image placeholder, or extra image area.
- Render only authoritative StatTrak™ and Souvenir status icons. Do not fabricate Armoury or SkinRush Pick data.
- Follow the approved conservative source-selection rule exactly; never select a relationship alphabetically or by array position.
- Support desktop and tablet container widths, target five cards on large desktop, and add no phone-specific breakpoint or UX.
- Wix Studio disables network APIs inside the custom-element editor sandbox; final data verification must use the test/live site.
- Do not modify navigation, authentication, profiles, database source data, unrelated Wix pages, or the expanded-panel information architecture.

---

## File Structure

### Backend files

- Modify `skins/query.js`: recognize and strictly validate `sort`.
- Create `skins/sort.js`: own supported sort values, fixed SQL fragments, confirmed rarity rank, and fixed search-relevance SQL.
- Modify `skins/service.js`: apply relevance and selected sort before pagination.
- Modify `test/skins-query.test.js`: parser/default/invalid-sort coverage.
- Modify `test/skins-service.test.js`: SQL allowlist, rarity, relevance, pagination, and deterministic ordering coverage.
- Modify `test/app.test.js`: HTTP `400` contract for invalid sort and unchanged array/count contract for valid sort.

### Widget files

- Modify `src/site/widgets/custom-elements/skinrush-skin-database/types.ts`: add `SkinSort` and `FilterState.sort`.
- Create `src/site/widgets/custom-elements/skinrush-skin-database/sort.ts`: own frontend sort labels and validation.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/filter-state.ts`: parse, serialize, clear, and preserve sort.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/controller.ts`: add immediate sort/source/list-toggle operations through the existing request pipeline.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/api.ts`: include sort through existing serialized state.
- Create `src/site/widgets/custom-elements/skinrush-skin-database/card-view.ts`: derive wear span, source state, float presentation, and safely formatted descriptions.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/render-filters.ts`: render six accessible checkbox popovers and summaries.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/render-results.ts`: render corrected cards, breadcrumbs, sources, tooltips, and Sort by.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/element.tsx`: delegate popover, checkbox, sort, source, keyboard, and outside-click behavior.
- Modify `src/site/widgets/custom-elements/skinrush-skin-database/element.module.css`: implement approved card proportions, artwork overflow, popovers, tooltips, results header, and five-column container adaptation.
- Modify `package.json` and `package-lock.json`: declare the Font Awesome core/icon packages used to render the two approved status symbols from a maintained icon library.

### Widget tests

- Modify `test/skin-widget-filter-state.test.ts`: sort URL/default/clear behavior.
- Modify `test/skin-widget-api.test.ts`: outgoing sort parameter.
- Modify `test/skin-widget-controller.test.ts`: immediate sort, source clicks, list toggles, history, and stale-request behavior.
- Create `test/skin-widget-card-view.test.ts`: conservative source, wear, float, and description safety helpers.
- Modify `test/skin-widget-render.test.ts`: card hierarchy, icon conditions, source actions, breadcrumbs, sort control, multi-select semantics, and CSS assertions.

---

### Task 1: Parse and validate backend sort values

**Files:**
- Create: `skins/sort.js`
- Modify: `skins/query.js`
- Test: `test/skins-query.test.js`

**Interfaces:**
- Produces: `DEFAULT_SKIN_SORT`, `SUPPORTED_SKIN_SORTS`, `isSkinSort(value)`, and `parseSkinQuery(...).sort`.
- Consumed by: Task 2 backend SQL ordering.

- [ ] **Step 1: Write failing parser tests**

Add assertions that missing sort defaults to `weapon_asc`, every approved value is accepted, `sort` marks the query enhanced, and unknown values throw the existing typed error:

```js
const supportedSorts = [
  'weapon_asc',
  'name_asc',
  'rarity_desc',
  'rarity_asc',
  'float_min_asc',
  'float_max_desc'
];

test('skin query defaults to weapon ordering', () => {
  assert.equal(parseSkinQuery({}).sort, 'weapon_asc');
});

for (const sort of supportedSorts) {
  test(`skin query accepts sort ${sort}`, () => {
    const query = parseSkinQuery({ sort });
    assert.equal(query.sort, sort);
    assert.equal(query.enhanced, true);
  });
}

test('skin query rejects an unsupported sort', () => {
  assert.throws(
    () => parseSkinQuery({ sort: 'price_desc' }),
    error => error instanceof SkinQueryError
      && error.field === 'sort'
      && error.message === 'sort contains an unsupported value: price_desc'
  );
});
```

Update existing whole-object expectations to include `sort: 'weapon_asc'`.

- [ ] **Step 2: Run focused tests and confirm the intended failure**

Run:

```powershell
node --test --test-name-pattern="sort|defaults preserve|combined readable" test/skins-query.test.js
```

Expected: FAIL because `sort` is absent and unsupported values are not rejected.

- [ ] **Step 3: Add the fixed sort contract**

Create `skins/sort.js`:

```js
export const DEFAULT_SKIN_SORT = 'weapon_asc';

export const SUPPORTED_SKIN_SORTS = Object.freeze([
  'weapon_asc',
  'name_asc',
  'rarity_desc',
  'rarity_asc',
  'float_min_asc',
  'float_max_desc'
]);

const SKIN_SORT_SET = new Set(SUPPORTED_SKIN_SORTS);

export function isSkinSort(value) {
  return SKIN_SORT_SET.has(value);
}
```

In `skins/query.js`, add `sort` to `recognisedKeys`, import the contract, and parse only the fixed values:

```js
function sortValue(value) {
  const text = first(value);
  if (text === undefined || text === null || text === '') return DEFAULT_SKIN_SORT;
  if (isSkinSort(text)) return text;
  throw new SkinQueryError('sort', `sort contains an unsupported value: ${text}`);
}
```

Return `sort: sortValue(rawQuery.sort)` from `parseSkinQuery`.

- [ ] **Step 4: Run focused and complete parser tests**

Run:

```powershell
node --test test/skins-query.test.js
```

Expected: all parser and wear-boundary tests PASS.

- [ ] **Step 5: Commit the parser slice**

```powershell
git add skins/sort.js skins/query.js test/skins-query.test.js
git commit -m "Add skin sort query contract"
```

---

### Task 2: Apply fixed server-side sorting and search relevance before pagination

**Files:**
- Modify: `skins/sort.js`
- Modify: `skins/service.js`
- Modify: `test/skins-service.test.js`
- Modify: `test/app.test.js`

**Interfaces:**
- Consumes: Task 1 `query.sort` and approved sort values.
- Produces: `buildSkinOrder(query): { sql: string, replacements: Record<string, unknown> }` and stable sorted `/api/skins` pages.

- [ ] **Step 1: Write failing SQL-order tests**

Add table-driven service tests that inspect the actual list query and verify fixed fragments precede `LIMIT :limit OFFSET :offset`:

```js
const expectedOrders = {
  weapon_asc: 's.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  name_asc: 's.skin_name ASC, s.weapon_name ASC, s.skin_id ASC',
  float_min_asc: 's.min_float ASC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  float_max_desc: 's.max_float DESC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC'
};

for (const [sort, fragment] of Object.entries(expectedOrders)) {
  test(`${sort} uses a fixed stable order before pagination`, async () => {
    const recorder = queryRecorder(sql => sql.includes('AS total') ? [{ total: 0 }] : []);
    const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });
    await service.search(parseSkinQuery({ sort, limit: '25', offset: '50' }));
    const sql = recorder.calls.find(call => call.sql.includes('LIMIT :limit')).sql;
    assert.match(sql, new RegExp(`${fragment.replaceAll('.', '\\.')}`));
    assert.ok(sql.indexOf('ORDER BY') < sql.indexOf('LIMIT :limit'));
  });
}
```

Add explicit rarity assertions for all seven exact labels and direction, plus a search test checking a fixed `CASE` relevance expression appears before the selected sort and uses replacements rather than embedding the search text. Verify final `s.skin_id ASC` appears once as the final tie-breaker:

```js
test('rarity ordering uses the confirmed game hierarchy', async () => {
  const recorder = queryRecorder(sql => sql.includes('AS total') ? [{ total: 0 }] : []);
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });
  await service.search(parseSkinQuery({ sort: 'rarity_desc' }));
  const sql = recorder.calls.find(call => call.sql.includes('LIMIT :limit')).sql;
  for (const [name, rank] of [
    ['Consumer Grade', 1], ['Industrial Grade', 2], ['Mil-Spec Grade', 3],
    ['Restricted', 4], ['Classified', 5], ['Covert', 6], ['Extraordinary', 7],
  ]) {
    assert.match(sql, new RegExp(`WHEN '${name}' THEN ${rank}`));
  }
  assert.match(sql, /END DESC NULLS LAST/);
});
```

Add HTTP tests:

```js
test('GET /api/skins rejects an unsupported sort safely', async () => {
  const skinService = { search: async () => assert.fail('service must not run') };
  const baseUrl = await startApp({ skinService });
  const response = await fetch(`${baseUrl}/api/skins?sort=price_desc`);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVALID_QUERY',
      field: 'sort',
      message: 'sort contains an unsupported value: price_desc'
    }
  });
});
```

Also verify a valid sorted request remains an array and exposes `X-Total-Count`. Make two identical HTTP requests against the same deterministic fake service result and assert identical response arrays and count headers:

```js
test('the same sorted URL produces the same ordered response', async () => {
  const ordered = [{ id: 'a' }, { id: 'b' }];
  const skinService = { search: async () => ({ items: ordered, total: 2 }) };
  const baseUrl = await startApp({ skinService });
  const url = `${baseUrl}/api/skins?weapon=AK-47&sort=name_asc&limit=25`;
  const first = await fetch(url);
  const second = await fetch(url);
  assert.deepEqual(await first.json(), ordered);
  assert.deepEqual(await second.json(), ordered);
  assert.equal(first.headers.get('X-Total-Count'), '2');
  assert.equal(second.headers.get('X-Total-Count'), '2');
});
```

- [ ] **Step 2: Run focused tests and confirm SQL/HTTP failures**

Run:

```powershell
node --test --test-name-pattern="sort|rarity|relevance|unsupported" test/skins-service.test.js test/app.test.js
```

Expected: FAIL because the service still uses the hard-coded weapon order.

- [ ] **Step 3: Implement the fixed SQL allowlist**

Extend `skins/sort.js` with only constant SQL fragments:

```js
const RARITY_RANK_SQL = `CASE s.rarity_name
  WHEN 'Consumer Grade' THEN 1
  WHEN 'Industrial Grade' THEN 2
  WHEN 'Mil-Spec Grade' THEN 3
  WHEN 'Restricted' THEN 4
  WHEN 'Classified' THEN 5
  WHEN 'Covert' THEN 6
  WHEN 'Extraordinary' THEN 7
  ELSE NULL
END`;

const SORT_SQL = Object.freeze({
  weapon_asc: 's.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  name_asc: 's.skin_name ASC, s.weapon_name ASC, s.skin_id ASC',
  rarity_desc: `${RARITY_RANK_SQL} DESC NULLS LAST, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC`,
  rarity_asc: `${RARITY_RANK_SQL} ASC NULLS LAST, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC`,
  float_min_asc: 's.min_float ASC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC',
  float_max_desc: 's.max_float DESC, s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC'
});
```

Build relevance using fixed SQL and derived replacements:

```js
const SEARCH_RELEVANCE_SQL = `CASE
  WHEN LOWER(s.skin_name) = LOWER(:searchExact) THEN 1
  WHEN LOWER(s.skin_name) LIKE LOWER(:searchPrefix) THEN 2
  WHEN LOWER(s.weapon_name) = LOWER(:searchExact) THEN 3
  WHEN LOWER(s.weapon_name) LIKE LOWER(:searchPrefix) THEN 4
  WHEN LOWER(s.skin_name) LIKE LOWER(:searchContains) THEN 5
  WHEN LOWER(s.weapon_name) LIKE LOWER(:searchContains) THEN 6
  ELSE 7
END ASC`;

export function buildSkinOrder(query) {
  const sortSql = SORT_SQL[query.sort] ?? SORT_SQL[DEFAULT_SKIN_SORT];
  if (!query.search) return { sql: sortSql, replacements: {} };
  return {
    sql: `${SEARCH_RELEVANCE_SQL}, ${sortSql}`,
    replacements: {
      searchExact: query.search,
      searchPrefix: `${query.search}%`,
      searchContains: `%${query.search}%`
    }
  };
}
```

In `skins/service.js`, call `buildSkinOrder(query)`, merge its replacements only into the list query, and construct:

```js
const listSql = `${LIST_SQL}${where}
ORDER BY ${order.sql}
LIMIT :limit OFFSET :offset`;
```

The count query keeps filter replacements only.

- [ ] **Step 4: Run backend tests**

Run:

```powershell
node --test test/skins-query.test.js test/skins-service.test.js test/app.test.js
```

Expected: all backend parser, service, and HTTP tests PASS.

- [ ] **Step 5: Commit backend sorting**

```powershell
git add skins/sort.js skins/service.js test/skins-service.test.js test/app.test.js
git commit -m "Sort skin results before pagination"
```

---

### Task 3: Add typed frontend sort state and preserve it through clear/history/API requests

**Files:**
- Create: `src/site/widgets/custom-elements/skinrush-skin-database/sort.ts`
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/types.ts`
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/filter-state.ts`
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/controller.ts`
- Modify: `test/skin-widget-filter-state.test.ts`
- Modify: `test/skin-widget-controller.test.ts`
- Modify: `test/skin-widget-api.test.ts`

**Interfaces:**
- Produces: `SkinSort`, `DEFAULT_SKIN_SORT`, `SKIN_SORT_OPTIONS`, `SkinWidgetController.setSort(sort)`, and sort-aware serialization.
- Consumed by: Tasks 4, 5, and 7 render/event code.

- [ ] **Step 1: Write failing state and controller tests**

Extend every `FilterState` fixture with `sort`. Add:

```ts
test('sort defaults without being written until changed', () => {
  const state = parseFilterState(new URLSearchParams());
  assert.equal(state.sort, 'weapon_asc');
  assert.equal(serialiseFilterState(state).has('sort'), false);
});

test('sort survives URL round trip and clear filters', () => {
  const state = parseFilterState(new URLSearchParams('sort=rarity_desc&weapon=AK-47'));
  assert.equal(clearFilters(state).sort, 'rarity_desc');
  assert.equal(serialiseFilterState(clearFilters(state)).get('sort'), 'rarity_desc');
});
```

Add a controller test:

```ts
test('sort changes immediately, resets offset, and survives filter changes', () => {
  const h = harness();
  h.controller.connect();
  h.controller.goToOffset(25);
  h.controller.setSort('rarity_desc');
  assert.equal(h.searches.at(-1)?.state.sort, 'rarity_desc');
  assert.equal(h.searches.at(-1)?.state.offset, 0);
  assert.equal(h.params().get('sort'), 'rarity_desc');
  h.controller.update({ weapons: ['AK-47'] }, false);
  assert.equal(h.searches.at(-1)?.state.sort, 'rarity_desc');
});
```

Update API serialization assertions to expect `sort=rarity_desc` only when non-default.

- [ ] **Step 2: Run focused frontend-state tests and confirm failures**

Run:

```powershell
node --import tsx --test test/skin-widget-filter-state.test.ts test/skin-widget-controller.test.ts test/skin-widget-api.test.ts
```

Expected: FAIL because `FilterState.sort` and `setSort` do not exist.

- [ ] **Step 3: Implement typed sort state**

Create `sort.ts`:

```ts
import type { SkinSort } from './types';

export const DEFAULT_SKIN_SORT: SkinSort = 'weapon_asc';

export const SKIN_SORT_OPTIONS: readonly { value: SkinSort; label: string }[] = [
  { value: 'weapon_asc', label: 'Weapon A–Z' },
  { value: 'name_asc', label: 'Skin name A–Z' },
  { value: 'rarity_desc', label: 'Rarity: highest first' },
  { value: 'rarity_asc', label: 'Rarity: lowest first' },
  { value: 'float_min_asc', label: 'Lowest minimum float' },
  { value: 'float_max_desc', label: 'Highest maximum float' },
];

export function isSkinSort(value: string | null): value is SkinSort {
  return SKIN_SORT_OPTIONS.some(option => option.value === value);
}
```

Add the exact union to `types.ts` and `sort: SkinSort` to `FilterState`:

```ts
export type SkinSort = 'weapon_asc' | 'name_asc' | 'rarity_desc'
  | 'rarity_asc' | 'float_min_asc' | 'float_max_desc';
```

Add `sort` to `OWNED_KEYS`. Parse invalid client URL values to the documented default, serialize non-default values, and change `clearFilters` to preserve the incoming state sort:

```ts
export function clearFilters(state: FilterState, pageSize = 25): FilterState {
  return { ...createDefaultFilterState(pageSize), sort: state.sort };
}
```

Add to `SkinWidgetController`:

```ts
setSort(sort: SkinSort): void {
  this.#snapshot = {
    ...this.#snapshot,
    state: { ...this.#snapshot.state, sort, offset: 0 },
    selectedId: null,
  };
  this.#writeHistory();
  this.#emit();
  this.#scheduleRefresh(false);
}
```

The existing API client requires no parallel parameter code because it already calls `serialiseFilterState`.

- [ ] **Step 4: Run frontend state/API/controller tests**

Run:

```powershell
node --import tsx --test test/skin-widget-filter-state.test.ts test/skin-widget-controller.test.ts test/skin-widget-api.test.ts
```

Expected: all selected tests PASS, including stale-response tests.

- [ ] **Step 5: Commit frontend state**

```powershell
git add src/site/widgets/custom-elements/skinrush-skin-database/sort.ts src/site/widgets/custom-elements/skinrush-skin-database/types.ts src/site/widgets/custom-elements/skinrush-skin-database/filter-state.ts src/site/widgets/custom-elements/skinrush-skin-database/controller.ts test/skin-widget-filter-state.test.ts test/skin-widget-controller.test.ts test/skin-widget-api.test.ts
git commit -m "Persist skin sort in widget state"
```

---

### Task 4: Render true multi-select checkbox popovers

**Files:**
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/render-filters.ts`
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/controller.ts`
- Modify: `test/skin-widget-render.test.ts`
- Modify: `test/skin-widget-controller.test.ts`

**Interfaces:**
- Consumes: existing list arrays in `FilterState`.
- Produces: `SkinWidgetController.toggleListValue(key, value)` and `renderFilters(state, options, loading, openFilter)` markup using `data-action="toggle-filter-popover"`, `data-multiselect`, and checkbox `data-filter-key`/`data-filter-value` attributes.
- Consumed by: Task 7 element event delegation.

- [ ] **Step 1: Write failing multi-select rendering tests**

Replace single-select expectations with assertions for all six popovers:

```ts
test('six list filters render accessible checkbox popovers', () => {
  const state = {
    ...createDefaultFilterState(),
    weapons: ['AK-47', 'FAMAS'],
  };
  const html = renderFilters(state, options, false, null);
  for (const name of ['weapon', 'collection', 'case', 'source_type', 'rarity', 'wear']) {
    assert.match(html, new RegExp(`data-multiselect="${name}"`));
  }
  assert.match(html, /aria-haspopup="true"/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /2 selected/);
  assert.doesNotMatch(html, /<select name="weapon"/);
});
```

Add controller toggling coverage:

```ts
test('list toggles preserve siblings and reset pagination', () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ weapons: ['AK-47'] }, false);
  h.controller.goToOffset(25);
  h.controller.toggleListValue('weapons', 'AWP');
  assert.deepEqual(h.searches.at(-1)?.state.weapons, ['AK-47', 'AWP']);
  h.controller.toggleListValue('weapons', 'AK-47');
  assert.deepEqual(h.searches.at(-1)?.state.weapons, ['AWP']);
  assert.equal(h.searches.at(-1)?.state.offset, 0);
});
```

- [ ] **Step 2: Run focused tests and confirm failures**

Run:

```powershell
node --import tsx --test --test-name-pattern="multi-select|checkbox popovers|list toggles" test/skin-widget-render.test.ts test/skin-widget-controller.test.ts
```

Expected: FAIL because list filters are native single selects and toggling is absent.

- [ ] **Step 3: Implement deterministic popover markup**

Replace `multiSelect()` with a renderer that creates a labelled trigger plus checkbox panel. `renderFilters` receives `openFilter: string | null`, passes `openFilter === name`, and therefore keeps the active panel open across React rerenders while checkbox changes fetch new results. Use stable IDs derived from the fixed filter name and escape all dynamic labels/values:

```ts
function multiSelect(
  name: string,
  label: string,
  values: readonly { value: string; label: string }[],
  active: readonly string[],
  open: boolean,
): string {
  const activeSet = new Set(active);
  const selectedLabel = active.length === 0
    ? `Any ${label.toLowerCase()}`
    : active.length === 1
      ? values.find(item => item.value === active[0])?.label ?? active[0]
      : `${active.length} selected`;
  const panelId = `sr-${name}-options`;
  return `
    <div class="sr-field sr-multiselect" data-multiselect="${escapeHtml(name)}">
      <span id="${panelId}-label">${escapeHtml(label)}</span>
      <button type="button" class="sr-multiselect-trigger" data-action="toggle-filter-popover"
        aria-haspopup="true" aria-expanded="${open}" aria-controls="${panelId}"
        aria-labelledby="${panelId}-label ${panelId}-summary">
        <span id="${panelId}-summary">${escapeHtml(selectedLabel)}</span><span aria-hidden="true">⌄</span>
      </button>
      <div class="sr-multiselect-panel" id="${panelId}" role="group"
        aria-labelledby="${panelId}-label"${open ? '' : ' hidden'}>
        ${values.map(item => `<label class="sr-checkbox-option"><input type="checkbox"
          data-filter-key="${escapeHtml(name)}" data-filter-value="${escapeHtml(item.value)}"
          ${activeSet.has(item.value) ? 'checked' : ''}><span>${escapeHtml(item.label)}</span></label>`).join('')}
      </div>
    </div>`;
}
```

Add a typed list-key map and controller toggle that adds/removes one value, preserves sort, resets offset, writes history, emits, and refreshes immediately.

- [ ] **Step 4: Run focused render/controller tests**

Run:

```powershell
node --import tsx --test test/skin-widget-render.test.ts test/skin-widget-controller.test.ts
```

Expected: selected tests PASS; tri-state selects remain unchanged.

- [ ] **Step 5: Commit multi-select rendering**

```powershell
git add src/site/widgets/custom-elements/skinrush-skin-database/render-filters.ts src/site/widgets/custom-elements/skinrush-skin-database/controller.ts test/skin-widget-render.test.ts test/skin-widget-controller.test.ts
git commit -m "Render checkbox skin filters"
```

---

### Task 5: Implement authoritative card-view derivations and safe descriptions

**Files:**
- Create: `src/site/widgets/custom-elements/skinrush-skin-database/card-view.ts`
- Create: `test/skin-widget-card-view.test.ts`

**Interfaces:**
- Produces:
  - `wearSpan(skin): string`
  - `floatPresentation(skin): { label: string; startPercent: number; widthPercent: number }`
  - `sourcePresentation(skin): SourcePresentation`
  - `formatDescription(value): string`
- Consumed by: Task 6 `render-results.ts`.

**Authoritative source check:** A 2026-08-13 inspection of all 1,475 live `/api/skins` records found 1,176 descriptions containing literal `\\n` sequences and exact `<i>...</i>` pairs, no actual newline characters, and no other HTML tags. The formatter must still accept both literal escape sequences and actual newline characters, while preserving the specification's exact-italic-only rule.

- [ ] **Step 1: Write failing helper tests**

Define exact expected source states:

```ts
test('source selection never invents a primary relationship', () => {
  assert.deepEqual(sourcePresentation({ ...skin, cases: [caseA] }), {
    kind: 'case', label: caseA.name, filterValue: caseA.id, names: [caseA.name], quiet: false,
  });
  assert.deepEqual(sourcePresentation({ ...skin, cases: [caseA, caseB] }), {
    kind: 'multiple-cases', label: 'Multiple sources', filterValue: null,
    names: [caseA.name, caseB.name], quiet: false,
  });
  assert.equal(sourcePresentation({ ...skin, cases: [], collections: [collectionA] }).kind, 'collection');
  assert.equal(sourcePresentation({ ...skin, cases: [], collections: [collectionA, collectionB] }).kind, 'multiple-collections');
  assert.deepEqual(sourcePresentation({ ...skin, cases: [], collections: [] }), {
    kind: 'missing', label: 'Source unavailable', filterValue: null, names: [], quiet: true,
  });
});
```

Add wear and float assertions:

```ts
assert.equal(wearSpan({ ...skin, availableWears: ['Factory New', 'Minimal Wear', 'Field-Tested'] }), 'Factory New → Field-Tested');
assert.equal(wearSpan({ ...skin, availableWears: ['Minimal Wear'] }), 'Minimal Wear');
assert.deepEqual(floatPresentation({ ...skin, min_float: 0.1, max_float: 0.7 }), {
  label: '0.10–0.70', startPercent: 10, widthPercent: 60,
});
```

Add description safety tests:

```ts
test('description supports only line breaks and italic emphasis', () => {
  assert.equal(formatDescription('Finish\\n\\r<i>Echo</i>'), 'Finish<br><em>Echo</em>');
  assert.equal(formatDescription('Finish\r\n<i>Echo</i>'), 'Finish<br><em>Echo</em>');
  assert.equal(
    formatDescription('<script>alert(1)</script><i onclick="bad()">No</i>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;&lt;i onclick=&quot;bad()&quot;&gt;No&lt;/i&gt;',
  );
});
```

- [ ] **Step 2: Run helper tests and confirm module-not-found failure**

Run:

```powershell
node --import tsx --test test/skin-widget-card-view.test.ts
```

Expected: FAIL because `card-view.ts` does not exist.

- [ ] **Step 3: Implement pure derivation helpers**

Define a discriminated source union:

```ts
export type SourcePresentation = {
  kind: 'case' | 'collection' | 'multiple-cases' | 'multiple-collections' | 'missing';
  label: string;
  filterValue: string | null;
  names: string[];
  quiet: boolean;
};
```

Return a clickable kind only for exactly one valid case, or no cases plus exactly one valid collection. Preserve relationship array order only for listing all names; never use it to choose a primary.

Implement description formatting by escaping first and restoring only complete exact italic pairs:

```ts
export function formatDescription(value: string | null): string {
  if (!value) return '';
  const normalized = value
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n\\r', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
    .replaceAll('\r\n', '\n')
    .replaceAll('\n\r', '\n')
    .replaceAll('\r', '\n');
  return escapeHtml(normalized)
    .replace(/&lt;i&gt;([\s\S]*?)&lt;\/i&gt;/gi, '<em>$1</em>')
    .replaceAll('\n', '<br>');
}
```

Only exact `<i>` and `</i>` tokens are recognized. Attribute-bearing or other tags remain escaped.

- [ ] **Step 4: Run helper tests**

Run:

```powershell
node --import tsx --test test/skin-widget-card-view.test.ts
```

Expected: all source, wear, float, and sanitization tests PASS.

- [ ] **Step 5: Commit helper slice**

```powershell
git add src/site/widgets/custom-elements/skinrush-skin-database/card-view.ts test/skin-widget-card-view.test.ts
git commit -m "Derive authoritative skin card content"
```

---

### Task 6: Render the corrected card hierarchy, breadcrumbs, sources, tooltips, and Sort by

**Files:**
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/render-results.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `test/skin-widget-render.test.ts`

**Interfaces:**
- Consumes: Task 3 sort state/options and Task 5 card-view helpers.
- Produces: semantic markup for approved cards and `data-action="apply-source-filter"` / `data-action="change-sort"` controls.
- Consumed by: Task 7 delegated interaction code and Task 8 CSS.

- [ ] **Step 1: Replace outdated card tests with approved hierarchy tests**

Assert ordering by string positions and removal of generic metadata:

```ts
const titleAt = html.indexOf('sr-card-title');
const iconsAt = html.indexOf('sr-status-strip');
const wearAt = html.indexOf('sr-wear-span');
const floatAt = html.indexOf('sr-float-bar');
const sourceAt = html.indexOf('sr-source-plate');
const artworkAt = html.indexOf('sr-artwork');
assert.deepEqual([titleAt, iconsAt, wearAt, floatAt, sourceAt, artworkAt],
  [...[titleAt, iconsAt, wearAt, floatAt, sourceAt, artworkAt]].sort((a, b) => a - b));
assert.doesNotMatch(html, /sr-rarity-dot|sr-wear-chip|sr-collection-context/);
assert.doesNotMatch(html, />Restricted<|>StatTrak™<|>Souvenir</);
```

Add separate fixtures for StatTrak-only, Souvenir-only, neither, single case, multiple cases, collection-only, multiple collections, and missing source. Assert source buttons carry exact filter metadata only for valid single relationships, while multiple states have focusable tooltips listing every linked name.

Assert:

```ts
assert.match(defaultHtml, /DATABASE &gt; SKINS/);
assert.match(singleCollectionHtml, /DATABASE &gt; The Falchion Collection &gt; SKINS/);
assert.match(html, /name="sort"/);
assert.match(html, /Weapon A–Z/);
assert.match(html, /1,475 skins/);
assert.doesNotMatch(html, /Steam|£|price|case-image/i);
```

- [ ] **Step 2: Run focused render tests and confirm failures**

Run:

```powershell
node --import tsx --test --test-name-pattern="card|source|breadcrumb|Sort by|description" test/skin-widget-render.test.ts
```

Expected: FAIL against the current metadata-heavy card.

- [ ] **Step 3: Render approved semantic markup**

Install the maintained icon-library packages explicitly rather than relying on a transitive dependency:

```powershell
npm.cmd install @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons
```

Import `icon` from `@fortawesome/fontawesome-svg-core`, `faChartSimple` for the orange StatTrak™ symbol, and `faCrown` for the yellow Souvenir symbol. Convert only those library icons to markup with `icon(definition).html.join('')`; the accessible outer status element supplies the label and the library SVG remains `aria-hidden="true"`.

Rebuild `card()` in the required order. Use compact focusable icon elements only when authoritative booleans are true:

```ts
function statusStrip(skin: SkinResult): string {
  const statuses = [
    skin.stattrak ? { className: 'sr-status--stattrak', label: 'Available as StatTrak™', icon: icon(faChartSimple).html.join('') } : null,
    skin.souvenir ? { className: 'sr-status--souvenir', label: 'Available as a Souvenir skin', icon: icon(faCrown).html.join('') } : null,
  ].filter((item): item is { className: string; label: string; icon: string } => item !== null);
  if (!statuses.length) return '<span class="sr-status-strip sr-status-strip--empty" aria-hidden="true"></span>';
  return `<span class="sr-status-strip">${statuses.map((status, index) => {
    const tooltipId = `sr-status-${escapeHtml(skin.id)}-${index}`;
    return `<span class="sr-status-icon ${status.className}" tabindex="0" role="img"
      aria-label="${escapeHtml(status.label)}" aria-describedby="${tooltipId}">
      <span aria-hidden="true">${status.icon}</span>
      <span class="sr-tooltip" id="${tooltipId}" role="tooltip">${escapeHtml(status.label)}</span>
    </span>`;
  }).join('')}</span>`;
}
```

No Armoury or SkinRush Pick element renders.

Render float positioning as CSS custom properties from bounded numeric helpers:

```html
<span class="sr-float-bar" role="img" aria-label="Possible float range 0.10 to 0.70"
  style="--sr-float-start:10%;--sr-float-width:60%">
  <span class="sr-float-active"></span><span class="sr-float-label">0.10–0.70</span>
</span>
```

Render a nested source `<button>` only for `case` and `collection`; use a focusable `<span>` plus tooltip for multiple states and a quiet span for missing. Keep card selection as the surrounding semantic button only if valid nested-button HTML is avoided: restructure the card so the main details opener and source button are sibling controls inside `<article>`, not one button inside another.

Render Sort by in the result header using `SKIN_SORT_OPTIONS`, with the current option selected. Use the corrected breadcrumb function and `formatDescription` in the expanded panel.

- [ ] **Step 4: Run render and helper tests**

Run:

```powershell
node --import tsx --test test/skin-widget-card-view.test.ts test/skin-widget-render.test.ts
```

Expected: all card hierarchy, source, tooltip, breadcrumb, sort, and description tests PASS.

- [ ] **Step 5: Commit semantic result rendering**

```powershell
git add package.json package-lock.json src/site/widgets/custom-elements/skinrush-skin-database/render-results.ts test/skin-widget-render.test.ts
git commit -m "Match approved SkinRush card hierarchy"
```

---

### Task 7: Wire checkbox popovers, source filtering, sort changes, and keyboard behavior

**Files:**
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/element.tsx`
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/controller.ts`
- Modify: `test/skin-widget-controller.test.ts`
- Modify: `test/skin-widget-render.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 4, and 6 data attributes and controller methods.
- Produces: complete no-reload behavior for multi-select, source clicks, sorting, arrow-key movement, Escape, focus return, and outside click.

- [ ] **Step 1: Add failing source and interaction tests at stable seams**

Controller source application tests:

```ts
test('source filters apply through the normal state and request pipeline', () => {
  const h = harness();
  h.controller.connect();
  h.controller.applySourceFilter('case', 'operation_riptide_case');
  assert.deepEqual(h.searches.at(-1)?.state.cases, ['operation_riptide_case']);
  assert.equal(h.params().get('case'), 'operation_riptide_case');
  assert.equal(h.searches.at(-1)?.state.offset, 0);
  h.controller.applySourceFilter('collection', 'the_falchion_collection');
  assert.deepEqual(h.searches.at(-1)?.state.collections, ['the_falchion_collection']);
});
```

Add rendering contract assertions that checkbox inputs, source controls, sort select, and popup triggers expose the exact data attributes consumed by `element.tsx`. Add a source-action assertion ensuring the card-detail opener is not an ancestor of the source button.

- [ ] **Step 2: Run focused tests and confirm missing controller behavior**

Run:

```powershell
node --import tsx --test --test-name-pattern="source filters|data-action|checkbox popovers" test/skin-widget-controller.test.ts test/skin-widget-render.test.ts
```

Expected: FAIL because `applySourceFilter` and final event contracts are absent.

- [ ] **Step 3: Add controller source filtering**

Add:

```ts
applySourceFilter(kind: 'case' | 'collection', value: string): void {
  const key = kind === 'case' ? 'cases' : 'collections';
  const values = this.#snapshot.state[key];
  const next = values.includes(value) ? values : [...values, value];
  this.update({ [key]: next }, false);
}
```

This preserves other filters and sort, resets offset through `update`, writes URL state, and uses existing cancellation/stale protection.

- [ ] **Step 4: Wire delegated React handlers**

Add `const [openFilter, setOpenFilter] = useState<string | null>(null)` to the custom element and pass it to `renderFilters`. This keeps a checkbox popover open when the controller emits new results or loading state after each selection.

In `handleChange`:

- Checkbox with `data-filter-key` calls `toggleListValue`.
- `select[name="sort"]` calls `setSort`.
- Existing StatTrak™, Souvenir, search, and float behavior remains unchanged.

In `handleClick`:

- `toggle-filter-popover` calls `setOpenFilter(current => current === name ? null : name)` so only one panel is open.
- `apply-source-filter` reads `data-source-kind` and `data-source-value`, calls the controller, and returns before card selection.
- `select-skin` retains expanded-panel behavior.

After opening, a layout effect locates the matching panel and focuses its first checkbox when the trigger interaction was keyboard-originated. Add one root `keydown` handler that closes on Escape and moves between checkbox options with ArrowDown/ArrowUp:

```ts
const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
  const panel = (event.target as Element | null)?.closest<HTMLElement>('.sr-multiselect-panel');
  if (!panel) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    const wrapper = panel.closest<HTMLElement>('.sr-multiselect');
    setOpenFilter(null);
    wrapper?.querySelector<HTMLButtonElement>('.sr-multiselect-trigger')?.focus();
    return;
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const options = [...panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const index = options.indexOf(event.target as HTMLInputElement);
  if (index < 0 || options.length === 0) return;
  event.preventDefault();
  const delta = event.key === 'ArrowDown' ? 1 : -1;
  options[(index + delta + options.length) % options.length]?.focus();
};
```

Add one document pointer listener in an effect that calls `setOpenFilter(null)` only when the click target is outside the currently open `.sr-multiselect`. Remove it during cleanup. Do not add per-option listeners. Native checkbox Space behavior remains intact.

- [ ] **Step 5: Run controller/render tests and TypeScript compile**

Run:

```powershell
node --import tsx --test test/skin-widget-controller.test.ts test/skin-widget-render.test.ts
npx.cmd tsc --noEmit
```

Expected: tests PASS and TypeScript exits 0 with no errors.

- [ ] **Step 6: Commit integrated interactions**

```powershell
git add src/site/widgets/custom-elements/skinrush-skin-database/element.tsx src/site/widgets/custom-elements/skinrush-skin-database/controller.ts test/skin-widget-controller.test.ts test/skin-widget-render.test.ts
git commit -m "Wire SkinRush filter and source interactions"
```

---

### Task 8: Implement approved card, popover, tooltip, sort, and container styling

**Files:**
- Modify: `src/site/widgets/custom-elements/skinrush-skin-database/element.module.css`
- Modify: `test/skin-widget-render.test.ts`

**Interfaces:**
- Consumes: Tasks 4 and 6 class names and CSS custom properties.
- Produces: five-card large-desktop grid, supported tablet adaptation, approved layered card proportions, and visible focus/hover states.

- [ ] **Step 1: Add failing CSS contract tests**

Extend the CSS test to assert required selectors/properties and exclusions:

```ts
assert.match(css, /\.sr-card-title/);
assert.match(css, /\.sr-status-strip/);
assert.match(css, /\.sr-float-active/);
assert.match(css, /left:\s*var\(--sr-float-start\)/);
assert.match(css, /width:\s*var\(--sr-float-width\)/);
assert.match(css, /\.sr-source-plate/);
assert.match(css, /\.sr-multiselect-panel/);
assert.match(css, /\.sr-tooltip/);
assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/i);
assert.match(css, /object-fit:\s*contain/i);
assert.match(css, /overflow:\s*visible/i);
assert.doesNotMatch(css, /@media/i);
```

Assert deleted selectors `.sr-rarity-dot`, `.sr-wear-chip`, and `.sr-collection-context` are absent.

- [ ] **Step 2: Run the CSS contract test and confirm failure**

Run:

```powershell
node --import tsx --test --test-name-pattern="widget CSS" test/skin-widget-render.test.ts
```

Expected: FAIL because the old card/chip selectors remain and new selectors are absent.

- [ ] **Step 3: Replace obsolete card styles with approved styling**

Keep palette variables and desktop/tablet minimum sizing. Implement:

- Grid `repeat(auto-fit, minmax(...))` tuned so the approved large Wix container produces five columns.
- Raised title plate overlapping the card top.
- Centred status strip with orange StatTrak™ and yellow Souvenir icon treatment.
- Wear span above a dark float track and green active interval positioned by custom properties.
- Raised source plate and quieter multiple/missing variants.
- Tooltip hidden by default and visible on `.sr-status-icon:hover`, `.sr-status-icon:focus-visible`, `.sr-source-state:hover`, and `.sr-source-state:focus-visible`.
- Artwork region with visible overflow, preserved aspect ratio, `object-fit: contain`, and pointer events configured so artwork never blocks card/source controls.
- Checkbox panels positioned above surrounding content with bounded height and internal scrolling; no native list-box appearance.
- Results count and compact Sort by control grouped in the header and wrapping by available container width.
- Cyan focus rings for triggers, options, source buttons, sort, cards, and pagination.

Use no `@media` rule; allow container-driven grid/flex wrapping. Do not add phone-specific behavior.

- [ ] **Step 4: Run render tests and Wix build**

Run:

```powershell
node --import tsx --test test/skin-widget-render.test.ts
npm.cmd run build
```

Expected: render/CSS tests PASS and Wix production build exits 0. Existing dependency warnings about ignored `use client` directives may remain non-fatal; report rather than suppress them.

- [ ] **Step 5: Commit styling**

```powershell
git add src/site/widgets/custom-elements/skinrush-skin-database/element.module.css test/skin-widget-render.test.ts
git commit -m "Style approved SkinRush database cards"
```

---

### Task 9: Run full regression verification and compare the Wix test site to the reference

**Files:**
- Modify only if a verified defect is found within approved scope.
- Create: `design-qa.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: fresh automated evidence, Wix build evidence, and an explicit visual-difference report.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
npm.cmd test
```

Expected: all backend and frontend tests PASS with zero failures.

- [ ] **Step 2: Run TypeScript and production build verification**

Run:

```powershell
npx.cmd tsc --noEmit
npm.cmd run build
```

Expected: TypeScript exits 0 and Wix build completes successfully.

- [ ] **Step 3: Inspect the integrated diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat HEAD~8..HEAD
```

Verify `.wix/` remains untracked and is not staged. Confirm no credentials, generated `dist/`, database exports, or unrelated Wix page changes are included.

- [ ] **Step 4: Obtain release authorization and create the Wix test/live preview at the reference width**

Before creating an external Wix version, ask the user for explicit release authorization. After approval, create the version through the existing script:

```powershell
npm.cmd run release
```

Enter a version comment that identifies the card, multi-select, and sort correction. Install/update that version on the Skin Rush development site if Wix requests it. Do not publish unrelated Wix page edits.

Open:

```text
https://www.skinrush.pro/cs2-skin-list-item?rc=test-site
```

Use the same large-desktop Wix container width as the supplied five-card reference. Do not use the Wix editor canvas as the data-loading acceptance surface because its sandbox disables `fetch` and `XMLHttpRequest`.

- [ ] **Step 5: Verify primary interactions and browser state**

In the test/live site, verify:

1. Page 1 displays five cards per row at the reference large-desktop width.
2. Each card follows title → icons → wear → float → source → artwork.
3. StatTrak™ and Souvenir icons appear only when their fields are true; tooltips work by hover and focus.
4. Armoury and SkinRush Pick icons do not appear.
5. A 0.10–0.70 skin displays an interval beginning near 10% and ending near 70%.
6. Single case/collection source buttons update URL and results without reload or opening details.
7. Multiple/missing source states are non-clickable; multiple-name tooltip and expanded details list actual relationships.
8. Default breadcrumb reads `DATABASE > SKINS`; one collection reads `DATABASE > [name] > SKINS`.
9. All six popovers allow multiple checkboxes, update summaries/chips, close with Escape/outside click, and restore through refresh/back/forward.
10. Sort changes URL, resets to page 1, persists across filters/Clear all/refresh/back/forward, and changes stable server-paginated results.
11. Loading, empty, error, pagination, expanded-card, and stale-request behavior remain intact.
12. No Steam price or case-image placeholder appears.

Check the browser console for widget errors.

- [ ] **Step 6: Perform visual QA against the supplied screenshots**

Compare the same large-desktop state against:

```text
C:\Users\cotto\AppData\Local\Temp\codex-clipboard-ba4376f8-16da-4326-9376-6bdf4f1190df.png
C:\Users\cotto\AppData\Local\Temp\codex-clipboard-da6c09f1-5b57-402d-b178-fe6b4b187de6.png
```

Write `design-qa.md` with these headings and a concrete pass/difference for each:

```markdown
# SkinRush Card Design QA

## Reference and viewport
## Title plate
## Status strip and tooltips
## Wear span and float bar
## Source plate and source behavior
## Artwork scale and overflow
## Rarity border
## Five-card grid
## Multi-select filters
## Sort and results header
## Remaining differences
## Final result
```

Set `Final result` to `passed` only when no P0/P1/P2 visual or functional issues remain. List P3 polish differences without claiming exact parity. If Wix preview or same-state capture is unavailable, set it to `blocked` and report the blocker.

- [ ] **Step 7: Fix only verified in-scope defects and rerun evidence**

For each defect, add or update a focused regression test, observe it fail, make the smallest approved-scope correction, rerun the focused test, then repeat Steps 1–6. If a correction would deviate from the committed specification, stop and ask the user before editing.

- [ ] **Step 8: Commit final verification artifact**

```powershell
git add design-qa.md
git commit -m "Verify SkinRush card and sorting update"
```

Do not push, deploy Render, or publish Wix unless the user explicitly authorizes those external actions during execution.
