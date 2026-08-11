# SkinRush Skin Database Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `GET /api/skins` with safe server-side filtering and build a version-controlled Wix custom-element skin database for supported desktop and tablet containers.

**Architecture:** Parse and validate all skin query parameters in a pure backend module, execute fixed parameterised PostgreSQL queries through an injected service, and preserve the legacy unfiltered array response. A Wix-generated `HTMLElement` widget keeps URL/filter/request state in small testable TypeScript modules and renders the approved SkinRush card/filter interface without downloading the full database.

**Tech Stack:** Node.js 22, Express 4, Sequelize 6, PostgreSQL, TypeScript, React settings panel, Wix CLI custom element, CSS Modules, Node's built-in test runner with `tsx` for TypeScript tests.

## Global Constraints

- Use British English in user-facing text.
- Keep `GET /api/skins` as the skin-search endpoint and preserve the existing unfiltered array response.
- Return filtered/paginated results as an array and expose pagination through `X-Total-Count`; do not add a JSON pagination envelope.
- Expose `X-Total-Count` through CORS with `Access-Control-Expose-Headers`.
- Use fixed SQL fragments plus Sequelize replacements; never concatenate unsanitised values.
- Same-category selections use OR; different categories use AND.
- Use `skin_cases` and `skin_collections`; do not duplicate relationship text onto skins.
- Do not mutate, import, repair, migrate, or synchronise live data.
- Ignore orphan relationship rows and prevent duplicate skin results at query level.
- Keep empty-image fallback behaviour; do not scrape or import images.
- Do not implement specialist tags, colours, Armoury classification, price, affiliate links, Steam-only behaviour, or unrelated site features.
- Match `#0A0014`, `#382051`, `#2D1A38`, `#00F0FF`, compact bento styling, supplied card composition, and subtle rarity borders.
- Support desktop and tablet Wix container widths only; do not add a phone breakpoint, mobile drawer, phone navigation, or stacked phone redesign.
- Below supported tablet placement, preserve a safe minimum layout/overflow and document phone layouts as unsupported.
- Upgrade `@wix/cli` to at least `1.1.192` and scaffold the custom element through `wix generate --params`.
- Keep the expanded panel structural and limited to authoritative existing data.
- Treat search fields, 25-result page size, multiple-collection breadcrumb copy, card-to-panel selection, and case/collection card placement as preview-stage defaults.

---

### Task 1: Wear boundaries and skin query parsing

**Files:**
- Create: `skins/wear.js`
- Create: `skins/query.js`
- Create: `test/skins-query.test.js`

**Interfaces:**
- Produces: `WEAR_RANGES`, `getWearRange(name)`, `getAvailableWears(minFloat, maxFloat)`.
- Produces: `SkinQueryError` and `parseSkinQuery(rawQuery)`.
- `parseSkinQuery` returns `{ enhanced, search, weapons, collections, cases, sourceTypes, rarities, stattrak, souvenir, floatMin, floatMax, wears, limit, offset }`.

- [ ] **Step 1: Write failing wear-boundary tests**

Create table-driven tests that prove point ranges at every boundary belong only
to the next wear category while ranges spanning a boundary can support both:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getAvailableWears } from '../skins/wear.js';

const boundaries = [
  [0.07, 'Factory New', 'Minimal Wear'],
  [0.15, 'Minimal Wear', 'Field-Tested'],
  [0.38, 'Field-Tested', 'Well-Worn'],
  [0.45, 'Well-Worn', 'Battle-Scarred']
];

for (const [value, excluded, included] of boundaries) {
  test(`${value} belongs to ${included}, not ${excluded}`, () => {
    const wears = getAvailableWears(value, value);
    assert.equal(wears.includes(included), true);
    assert.equal(wears.includes(excluded), false);
  });

  test(`a range spanning ${value} supports both adjacent wears`, () => {
    const wears = getAvailableWears(value - 0.001, value + 0.001);
    assert.equal(wears.includes(excluded), true);
    assert.equal(wears.includes(included), true);
  });
}
```

- [ ] **Step 2: Write failing query-contract tests**

Cover defaults, comma-separated decoding, trimming/deduplication, Boolean
tri-state, float bounds/order, all wear names, limit 1–100, offset, unknown wear,
and whether recognised parameters set `enhanced: true`:

```js
test('skin query parses combined readable filters', () => {
  assert.deepEqual(parseSkinQuery({
    search: '  redline ',
    weapon: 'AK-47,AWP,AK-47',
    collection: 'the_falchion_collection',
    case: 'case-4091,case-4001',
    source_type: 'case,souvenir_package',
    rarity: 'Classified,Covert',
    stattrak: 'true',
    souvenir: 'false',
    float_min: '0.07',
    float_max: '0.38',
    wear: 'Minimal Wear,Field-Tested',
    limit: '25',
    offset: '50'
  }), {
    enhanced: true,
    search: 'redline',
    weapons: ['AK-47', 'AWP'],
    collections: ['the_falchion_collection'],
    cases: ['case-4091', 'case-4001'],
    sourceTypes: ['case', 'souvenir_package'],
    rarities: ['Classified', 'Covert'],
    stattrak: true,
    souvenir: false,
    floatMin: 0.07,
    floatMax: 0.38,
    wears: ['Minimal Wear', 'Field-Tested'],
    limit: 25,
    offset: 50
  });
});
```

Assert `SkinQueryError` exposes `code: 'INVALID_QUERY'`, the invalid field, and
a British-English-safe message for each rejected value.

- [ ] **Step 3: Run tests and verify RED**

Run:

```console
node --test test/skins-query.test.js
```

Expected: FAIL because `skins/wear.js` and `skins/query.js` do not exist.

- [ ] **Step 4: Implement the wear contract**

Use one authoritative table and half-open overlap logic:

```js
export const WEAR_RANGES = Object.freeze([
  { name: 'Factory New', min: 0, max: 0.07, maxInclusive: false },
  { name: 'Minimal Wear', min: 0.07, max: 0.15, maxInclusive: false },
  { name: 'Field-Tested', min: 0.15, max: 0.38, maxInclusive: false },
  { name: 'Well-Worn', min: 0.38, max: 0.45, maxInclusive: false },
  { name: 'Battle-Scarred', min: 0.45, max: 1, maxInclusive: true }
]);

function overlaps(minFloat, maxFloat, wear) {
  return wear.maxInclusive
    ? maxFloat >= wear.min && minFloat <= wear.max
    : maxFloat >= wear.min && minFloat < wear.max;
}
```

`getAvailableWears` validates finite ordered floats and returns matching names in
the table order.

- [ ] **Step 5: Implement the minimal parser**

Parse only the documented keys. Reusable helpers must:

```js
function list(value) {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value : [value];
  return [...new Set(raw.flatMap(item => String(item).split(','))
    .map(item => item.trim()).filter(Boolean))];
}
```

Use strict string checks for Booleans, `Number.isFinite` for floats/integers,
0–1 float validation, `floatMin <= floatMax`, and exact wear-name validation.
Defaults are limit 25 and offset 0, while `enhanced` is false only when none of
the documented parameters is present.

- [ ] **Step 6: Verify GREEN and commit**

```console
node --test test/skins-query.test.js
git diff --check
git add skins/wear.js skins/query.js test/skins-query.test.js
git commit -m "Add skin filter query contract"
```

Expected: all query and boundary tests pass.

### Task 2: Parameterised PostgreSQL skin service

**Files:**
- Create: `skins/service.js`
- Create: `test/skins-service.test.js`

**Interfaces:**
- Consumes: `createSkinService({ sequelize, Skin })`.
- Produces: `legacyList()`, `search(parsedQuery)`, and `filterOptions()`.
- `search` returns `{ items, total }`; the HTTP layer converts this to an array plus `X-Total-Count`.

- [ ] **Step 1: Write failing service tests for fixed SQL and replacements**

Use a deterministic Sequelize fake that records `query(sql, options)` calls.
Test one filter at a time plus a full combination. Assert:

```js
assert.match(listSql, /s\.weapon_name IN \(:weapons\)/);
assert.match(listSql, /EXISTS[\s\S]+skin_collections/);
assert.match(listSql, /EXISTS[\s\S]+skin_cases/);
assert.match(listSql, /c\.source_type IN \(:sourceTypes\)/);
assert.equal(listOptions.replacements.search, '%redline%');
assert.deepEqual(listOptions.replacements.weapons, ['AK-47', 'AWP']);
assert.equal(listSql.includes('AK-47'), false);
```

Also assert both list and count queries receive the same filter replacements,
while list alone receives `limit` and `offset`.

- [ ] **Step 2: Write failing tests for wear SQL boundaries**

For Factory New, assert the fixed fragment contains:

```sql
s.max_float >= :wearMin0 AND s.min_float < :wearMax0
```

For Battle-Scarred, assert it contains:

```sql
s.max_float >= :wearMin0 AND s.min_float <= :wearMax0
```

Assert multiple wears are parenthesised with OR and the complete wear group is
ANDed with other categories.

- [ ] **Step 3: Write failing mapping/options/legacy tests**

Verify:

- `legacyList()` calls `Skin.findAll()` and returns it unchanged.
- `search()` maps JSON collections/cases, exact existing skin fields, and
  `availableWears` derived through `getAvailableWears`.
- `filterOptions()` uses one SQL round trip and returns sorted weapons,
  collections, cases, source types, rarities, and the five wear definitions.
- Null/empty relationship aggregates become empty arrays.

- [ ] **Step 4: Run tests and verify RED**

```console
node --test test/skins-service.test.js
```

Expected: FAIL because the service does not exist.

- [ ] **Step 5: Implement fixed WHERE construction**

Build `conditions` and `replacements` from recognised fields only:

```js
if (query.search) {
  conditions.push('(s.skin_name ILIKE :search OR s.weapon_name ILIKE :search)');
  replacements.search = `%${query.search}%`;
}
if (query.weapons.length) {
  conditions.push('s.weapon_name IN (:weapons)');
  replacements.weapons = query.weapons;
}
if (query.collections.length) {
  conditions.push(`EXISTS (
    SELECT 1 FROM skin_collections selected_sc
    WHERE selected_sc.skin_id = s.skin_id
      AND selected_sc.collection_id IN (:collections)
  )`);
  replacements.collections = query.collections;
}
```

Use equivalent fixed `EXISTS` fragments for case and source type, exact-column
conditions for rarity/Boolean filters, closed overlap for requested float
intervals, and `WEAR_RANGES` for wear fragments. User input may appear only in
`replacements`.

- [ ] **Step 6: Implement list/count queries without duplicate rows**

Use pre-aggregated CTEs for valid related data:

```sql
WITH collection_data AS (
  SELECT sc.skin_id,
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.collection_id,
           'name', c.collection_name
         )) AS collections
  FROM skin_collections sc
  JOIN collections c ON c.collection_id = sc.collection_id
  GROUP BY sc.skin_id
), case_data AS (
  SELECT sc.skin_id,
         jsonb_agg(DISTINCT jsonb_build_object(
           'id', c.case_id,
           'name', c.case_name,
           'sourceType', c.source_type
         )) AS cases
  FROM skin_cases sc
  JOIN cases c ON c.case_id = sc.case_id
  GROUP BY sc.skin_id
)
SELECT s.skin_id AS id,
       s.skin_name AS name,
       s.weapon_name AS weapon,
       s.rarity_name AS rarity,
       s.rarity_color AS "rarityColor",
       s.category_name AS category,
       s.min_float, s.max_float, s.stattrak, s.souvenir,
       s.image_url AS image,
       COALESCE(cd.collections, '[]'::jsonb) AS collections,
       COALESCE(cad.cases, '[]'::jsonb) AS cases
FROM skins s
LEFT JOIN collection_data cd ON cd.skin_id = s.skin_id
LEFT JOIN case_data cad ON cad.skin_id = s.skin_id
```

Append only the fixed WHERE clause, stable ordering by weapon/name/ID, and
`LIMIT :limit OFFSET :offset`. Count directly from `skins s` with the same WHERE
clause and no relationship joins. Execute list and count together with
`Promise.all`, using Sequelize `QueryTypes.SELECT`.

- [ ] **Step 7: Implement one-round-trip filter options**

Use one `SELECT jsonb_build_object(...) AS options` containing ordered
subqueries over authoritative tables. Do not hard-code weapons, rarities,
collections, cases, or source types. Add `WEAR_RANGES` after mapping the row.

- [ ] **Step 8: Verify GREEN and commit**

```console
node --test test/skins-service.test.js
git diff --check
git add skins/service.js test/skins-service.test.js
git commit -m "Add parameterised skin filter service"
```

Expected: service tests prove replacement use, wear comparison operators,
stable mapping, dynamic options, and duplicate-safe query structure.

### Task 3: Skin HTTP contracts and exposed pagination header

**Files:**
- Create: `routes/skins.js`
- Modify: `app.js`
- Modify: `server.js`
- Modify: `test/app.test.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: injected `{ legacyList, search, filterOptions }` skin service.
- Produces: `GET /api/skins`, `GET /api/skins/filters`, and preserved `POST /api/skins/filter`.

- [ ] **Step 1: Write failing HTTP tests**

Add real ephemeral-server tests for:

```js
test('filtered skins remain an array and expose total count', async () => {
  const skinService = {
    async search(query) {
      assert.equal(query.limit, 25);
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
});
```

Also test legacy no-query passthrough, filter options, invalid query 400, generic
500 failures, supported `false` Booleans, and preservation of the legacy POST
weapon filter.

- [ ] **Step 2: Run focused tests and verify RED**

```console
node --test test/app.test.js
```

Expected: FAIL because `skinService`, router contracts, total header, and CORS
exposure are absent.

- [ ] **Step 3: Implement the router**

Create `createSkinsRouter({ skinService, sequelize })` with `/filters`, `/`, and
legacy `POST /filter`. For `GET /`:

```js
const query = parseSkinQuery(req.query);
if (!query.enhanced) return res.json(await skinService.legacyList());
const { items, total } = await skinService.search(query);
res.set('X-Total-Count', String(total));
return res.json(items);
```

Return `INVALID_QUERY` with field/message on 400 and a generic
`Failed to fetch skins` response for server failures while logging details.

- [ ] **Step 4: Mount the router and expose the header**

In `app.js`, add:

```js
const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true
};
```

Mount the injected skin router at `/api/skins` and remove only the superseded
inline GET/POST handlers. In `server.js`, construct
`createSkinService({ sequelize, Skin })` and inject it without changing other
services.

- [ ] **Step 5: Document the extended endpoint**

Update the README with the exact query parameters, array response compatibility,
`X-Total-Count`, `/api/skins/filters`, AND/OR rules, and a short URL-encoded
example. State that phone layouts are not part of the API/widget MVP only in the
widget section added later; do not alter unrelated documentation.

- [ ] **Step 6: Verify and commit**

```console
node --test test/app.test.js test/skins-query.test.js test/skins-service.test.js
npm.cmd test
git diff --check
git add routes/skins.js app.js server.js test/app.test.js README.md
git commit -m "Expose filtered skins API"
```

Expected: all backend tests pass and existing endpoints remain green.

### Task 4: Wix toolchain upgrade and CLI scaffold

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create through Wix CLI: `src/extensions.ts`
- Create through Wix CLI: `src/extensions/site/widgets/skinrush-skin-database/*`

**Interfaces:**
- Produces: Wix-registered `skinrush-skin-database` custom element and settings panel.

- [ ] **Step 1: Upgrade the Wix CLI and add TypeScript test execution**

Run:

```console
npm.cmd install --save-dev @wix/cli@^1.1.192 tsx
npx.cmd wix --version
```

Expected: installed Wix CLI is at least `1.1.192`. Update the test script to run
both existing JavaScript tests and new TypeScript tests through `tsx`:

```json
"test": "node --import tsx --test \"test/**/*.test.js\" \"test/**/*.test.ts\""
```

- [ ] **Step 2: Scaffold through Wix CLI**

Run:

```console
npx.cmd wix generate --params '{"extensionType":"CUSTOM_ELEMENT","folder":"skinrush-skin-database","name":"SkinRush Skin Database"}'
```

If parameter validation fails, run exactly:

```console
npx.cmd wix schema generate --type CUSTOM_ELEMENT
```

Adjust the JSON to the printed schema and rerun generation. Do not handwrite the
builder, UUID, or `src/extensions.ts`. Record the returned `newFiles` and use
those exact generated paths for subsequent steps.

- [ ] **Step 3: Establish extension defaults without business logic**

Keep the generated UUID/tag name. Set `installation.autoAdd` to `false`, allow
width stretching, and choose a desktop/tablet database default height large
enough for the inline controls, first result rows, and structural detail panel.
Keep the live API default as a kebab-case widget property:

```text
api-base-url=https://skinrush-api-8z3s.onrender.com
page-size=25
```

These are editable preview-stage defaults, not hard-coded permanent product
decisions.

- [ ] **Step 4: Run initial type/build validation and commit scaffold**

```console
npx.cmd tsc --noEmit
npx.cmd wix build
git diff --check
git add package.json package-lock.json src/extensions.ts src/extensions/site/widgets/skinrush-skin-database
git commit -m "Scaffold SkinRush database widget"
```

Expected: generated scaffold compiles and builds before business logic is added.

### Task 5: Widget filter state and API client

**Files:**
- Create: `src/extensions/site/widgets/skinrush-skin-database/types.ts`
- Create: `src/extensions/site/widgets/skinrush-skin-database/filter-state.ts`
- Create: `src/extensions/site/widgets/skinrush-skin-database/wear.ts`
- Create: `src/extensions/site/widgets/skinrush-skin-database/api.ts`
- Create: `test/skin-widget-filter-state.test.ts`
- Create: `test/skin-widget-api.test.ts`

**Interfaces:**
- Produces: `FilterState`, `SkinResult`, `FilterOptions`, `parseFilterState`, `serialiseFilterState`, `removeFilter`, `clearFilters`.
- Produces: `SkinApiClient.loadOptions()` and `SkinApiClient.search(state, signal)`.

- [ ] **Step 1: Write failing URL-state tests**

Test readable comma-separated serialisation, correct encoding, unrelated query
parameter preservation, defaults, one-chip removal, clear-all, and round trips:

```ts
test('filter state survives a URL round trip', () => {
  const state = {
    search: 'red line',
    weapons: ['AK-47', 'AWP'],
    collections: ['the_falchion_collection'],
    cases: [], sourceTypes: [], rarities: ['Covert'], wears: ['Factory New'],
    stattrak: true, souvenir: null, floatMin: 0, floatMax: 0.07,
    limit: 25, offset: 0
  } satisfies FilterState;
  const params = serialiseFilterState(state, new URLSearchParams('ref=nav'));
  assert.equal(params.get('ref'), 'nav');
  assert.deepEqual(parseFilterState(params), state);
});
```

`clearFilters` must remove only widget-owned keys and retain unrelated page
parameters.

- [ ] **Step 2: Write failing API-client tests**

Inject `fetch` into `SkinApiClient`. Assert it:

- Requests `/api/skins/filters` and `/api/skins?...`.
- Reads `X-Total-Count` without expecting a JSON envelope.
- Rejects non-array result bodies.
- Distinguishes aborts from API failures.
- Passes the caller's `AbortSignal`.
- Does not retain the full database client-side.

- [ ] **Step 3: Run tests and verify RED**

```console
node --import tsx --test test/skin-widget-filter-state.test.ts test/skin-widget-api.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement strict shared types and state helpers**

Define exact nullable/array fields matching Task 1. Use `URLSearchParams`, not
manual query-string concatenation. `serialiseFilterState` omits default/empty
values, uses comma-separated category values, and writes `limit` only when it
differs from the configured page size.

- [ ] **Step 5: Implement abort-aware API client**

`search` returns:

```ts
interface SkinPage {
  items: SkinResult[];
  total: number;
}
```

Read `response.headers.get('X-Total-Count')`, validate it as a non-negative
integer, validate the body as an array, and throw a typed public-safe error on
bad responses. Do not expose response bodies or database errors in UI messages.

- [ ] **Step 6: Verify and commit**

```console
npm.cmd test
npx.cmd tsc --noEmit
git diff --check
git add src/extensions/site/widgets/skinrush-skin-database/types.ts src/extensions/site/widgets/skinrush-skin-database/filter-state.ts src/extensions/site/widgets/skinrush-skin-database/wear.ts src/extensions/site/widgets/skinrush-skin-database/api.ts test/skin-widget-filter-state.test.ts test/skin-widget-api.test.ts
git commit -m "Add widget filter state and API client"
```

### Task 6: SkinRush filters, cards, expanded panel, and supported layout

**Files:**
- Create: `src/extensions/site/widgets/skinrush-skin-database/render-filters.ts`
- Create: `src/extensions/site/widgets/skinrush-skin-database/render-results.ts`
- Modify: `src/extensions/site/widgets/skinrush-skin-database/skinrush-skin-database.module.css`
- Create: `test/skin-widget-render.test.ts`

**Interfaces:**
- Produces escaped semantic HTML render functions for controls, states, cards, breadcrumbs, pagination, and expanded detail.
- Produces class names consumed by the generated widget element.

- [ ] **Step 1: Invoke screenshot-to-code guidance before visual implementation**

Use the `product-design:image-to-code` skill against the three supplied card and
layout screenshots. Extract layout, spacing, layering, typography hierarchy,
rarity-border, and expanded-row relationships. Do not reinterpret navigation or
invent a new card language.

- [ ] **Step 2: Write failing render-contract tests**

Assert generated markup includes:

- Real labelled search, select, checkbox/radio, number, and button controls.
- Active-filter buttons with accessible removal labels.
- `Clear all` and `Clear filters` behaviour hooks.
- `No skins match these filters.` only for successful empty results.
- A distinct retryable error region.
- `aria-busy`/non-blocking loading status while existing cards remain.
- One semantic card button per skin.
- All authoritative available wear chips on one card.
- No price, affiliate action, invented metadata, or broken `<img src="">`.
- A structural expanded panel limited to authoritative existing fields.

- [ ] **Step 3: Run tests and verify RED**

```console
node --import tsx --test test/skin-widget-render.test.ts
```

Expected: FAIL because render modules do not exist.

- [ ] **Step 4: Implement escaped render functions**

Add a small `escapeHtml` helper used for every API/user-derived string. Use data
attributes for delegated events, stable skin IDs for selection, and British
English copy. Breadcrumb defaults follow the specification but remain isolated
constants for preview refinement.

- [ ] **Step 5: Reproduce the approved card composition**

Map authoritative fields as follows:

- Header: weapon and skin name.
- Accent/border: validated rarity colour, with a safe SkinRush fallback.
- Status area: StatTrak™/Souvenir availability and rarity.
- Quality area: all `availableWears` as compact chips.
- Context: valid related case/collection data only.
- Image area: valid non-empty `image` URL or finished branded fallback.
- Detail: description, floats, phase, category, and valid relationships only
  when present.

Do not render a market price or any purchase/action control.

- [ ] **Step 6: Implement desktop/tablet container-driven CSS**

Use CSS Grid with a maximum five-column content width and an intrinsic card
minimum that reduces column count as the actual Wix container narrows. Do not
name or create a phone breakpoint. Give the widget a supported tablet minimum
inline size and safe horizontal overflow below it instead of switching to a
phone card layout.

Use a CSS container on the root and shared design tokens:

```css
.root {
  --sr-bg: #0A0014;
  --sr-dark: #382051;
  --sr-dark-alt: #2D1A38;
  --sr-cyan: #00F0FF;
  container-type: inline-size;
  min-inline-size: var(--sr-supported-min-inline-size);
}

.resultsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(var(--sr-card-min), 1fr));
  max-inline-size: var(--sr-five-card-max);
}
```

Choose the intrinsic sizing from the supplied five-card reference and Wix
desktop/tablet preview, not from a claimed phone/tablet viewport breakpoint.
Include visible `:focus-visible` treatment and reduced-motion handling.

- [ ] **Step 7: Verify and commit**

```console
npm.cmd test
npx.cmd tsc --noEmit
git diff --check
git add src/extensions/site/widgets/skinrush-skin-database/render-filters.ts src/extensions/site/widgets/skinrush-skin-database/render-results.ts src/extensions/site/widgets/skinrush-skin-database/skinrush-skin-database.module.css test/skin-widget-render.test.ts
git commit -m "Build SkinRush database interface"
```

### Task 7: Widget lifecycle, history, requests, and Wix settings

**Files:**
- Modify: `src/extensions/site/widgets/skinrush-skin-database/skinrush-skin-database.tsx`
- Modify: `src/extensions/site/widgets/skinrush-skin-database/skinrush-skin-database.panel.tsx`
- Modify: `src/extensions/site/widgets/skinrush-skin-database/skinrush-skin-database.extension.ts`
- Create: `test/skin-widget-controller.test.ts`

**Interfaces:**
- Produces: connected Wix custom element with `api-base-url` and `page-size` observed attributes.
- Consumes: filter state, API client, render modules, generated CSS module.

- [ ] **Step 1: Invoke Wix Design System guidance before editing the panel**

Read and apply the `wix-design-system` skill before changing the first generated
`.tsx` file that imports `@wix/design-system`. The panel exposes only API base URL
and bounded page size; it does not add theme controls that would weaken the
approved visual identity.

- [ ] **Step 2: Write failing controller/lifecycle tests**

Keep request coordination in an exported testable controller. Tests prove:

- Checkbox/select changes request immediately.
- Search/float changes request after 300 ms.
- A second request aborts the first.
- An older resolved promise cannot overwrite newer results.
- `popstate` reparses URL state and requests results.
- Individual removal and clear-all update history without discarding unrelated
  parameters.
- Selection computes a detail insertion point from measured card row positions,
  not hard-coded column counts.
- Disconnect cancels debounce, aborts requests, and removes listeners.

- [ ] **Step 3: Run tests and verify RED**

```console
node --import tsx --test test/skin-widget-controller.test.ts
```

Expected: FAIL because controller/lifecycle behaviour is absent.

- [ ] **Step 4: Implement the custom element lifecycle**

The default export extends `HTMLElement`. It declares kebab-case observed
attributes, renders a stable root, attaches one delegated `input`/`change`/`click`
surface, listens for `popstate`, and uses `ResizeObserver` to reinsert detail
after the selected card's actual row. Wix owns `customElements.define()`.

Keep filter controls mounted and update their selected state without blanking the
widget. Preserve current cards during loading, render empty only after a
successful zero-result response, and render error separately with retry.

- [ ] **Step 5: Implement settings and builder defaults**

Use Wix Design System components and `widget.getProp`/`widget.setProp` with
`api-base-url` and `page-size`. Validate page size 1–100. Keep generated UUID,
tag, and paths. Set opt-in placement (`autoAdd: false`), stretchable width, and
desktop/tablet-oriented default height.

- [ ] **Step 6: Verify and commit**

```console
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd wix build
git diff --check
git add src/extensions/site/widgets/skinrush-skin-database test/skin-widget-controller.test.ts
git commit -m "Integrate SkinRush database widget lifecycle"
```

### Task 8: Integrated verification, preview, and deployment handoff

**Files:**
- Modify: `README.md` only if generated placement instructions are not already covered in Task 3.

**Interfaces:**
- Produces: verified local implementation, Wix preview, and explicit manual placement steps.

- [ ] **Step 1: Run complete local verification**

```console
npm.cmd install
npm.cmd test
npx.cmd tsc --noEmit
npx.cmd wix build
git diff --check
```

Expected: zero test/type/build failures and no whitespace errors.

- [ ] **Step 2: Run read-only live database query checks**

Using configured PostgreSQL credentials with `PGDATABASE=skinrush_db`, execute
the service-generated SQL for:

- no filters with limit 25;
- one/multiple weapons;
- one/multiple collections;
- one/multiple cases;
- source type;
- one/multiple rarities;
- StatTrak™ true/false;
- Souvenir true/false;
- float minimum/maximum/interval;
- every wear and combined filters;
- zero-result filter.

Confirm every response has at most the requested limit, count is non-negative,
and returned skin IDs are unique. Run `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
for representative collection and case filters. Do not add indexes unless the
measured plans demonstrate a material issue; any proposed index becomes a
separate reviewed change.

- [ ] **Step 3: Start Wix preview**

```console
npx.cmd wix preview
```

Capture the site/dashboard preview URLs. Verify the custom element at the actual
supported Wix desktop and tablet placements:

- Grid reaches five columns on the intended large desktop container.
- Column count adapts as supported container width decreases.
- Inline filters remain usable at desktop/tablet widths.
- Expanded detail follows the selected card row.
- Loading, empty, error, retry, clear-one, and clear-all states work.
- Refresh and browser back/forward restore state.
- Rapid changes never show stale results.
- Keyboard focus/order/labels are usable.
- Narrower-than-supported content remains safely accessible without a phone
  redesign; record phone-sized layouts as unsupported.

- [ ] **Step 4: Verify the live API after backend deployment**

After the user pushes/deploys, use read-only requests with
`Origin: https://www.skinrush.pro` to confirm:

```text
GET /api/skins?weapon=AK-47&limit=1
GET /api/skins?weapon=AK-47,AWP&rarity=Classified&limit=25
GET /api/skins?collection=the_falchion_collection&wear=Factory%20New&limit=25
GET /api/skins/filters
```

Confirm array bodies, `X-Total-Count`,
`Access-Control-Expose-Headers: X-Total-Count`, generic failures, and unchanged
health/collections routes.

- [ ] **Step 5: Review final diff and commit verification documentation**

```console
git status --short --branch
git diff --check
git log --oneline --decorate -8
```

Review for secrets, generated sample content, unrelated changes, schema/data
mutations, scraped assets, invented metadata, and phone-specific UX. Commit any
final approved README placement clarification:

```console
git add README.md
git commit -m "Document SkinRush widget setup"
```

Skip that commit when README is already complete and unchanged.

- [ ] **Step 6: Present manual Wix Studio steps**

Report the generated widget name/tag and instruct the user to:

1. Install/release the Wix app version containing the custom element.
2. Add `SkinRush Skin Database` to the intended public Wix Studio page.
3. Stretch it to the approved desktop/tablet container width and set sufficient
   height for the inline filters/results/detail.
4. Confirm the API base URL points to the Render production service.
5. Check desktop and tablet placements only; phone-sized layouts are unsupported
   for this MVP.

The completion report must list files, reused code, API/query parameters,
schema/index changes (expected: none), tests, verification results, and deferred
metadata/image/relationship-data limitations.
