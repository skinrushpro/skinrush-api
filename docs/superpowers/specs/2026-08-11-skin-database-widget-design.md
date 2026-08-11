# SkinRush Skin Database Widget Design

## Goal

Build a version-controlled Wix custom-element widget and extend the existing
`GET /api/skins` endpoint to provide fast, composable filtering for the public
SkinRush skin database. Anonymous visitors and Steam-authenticated visitors use
the same experience in this release.

## Scope

This release includes:

- A visitor-facing Wix custom-element widget stored in this repository.
- Server-side skin search and filtering through the existing `/api/skins`
  endpoint.
- Dynamic filter options sourced from the existing PostgreSQL tables.
- Desktop and tablet layouts that reproduce the supplied SkinRush card design.
- URL-backed filter state, loading, empty, and error states.
- Automated backend contracts and testable frontend state/query logic.

This release does not change navigation, authentication, profiles, trade-up
logic, unrelated Wix pages, or database source data. It does not add market
prices, affiliate links, specialist SkinRush classifications, colour tags, or
Steam-specific behaviour.

## Existing System

The repository uses Node.js 22, Express 4, Sequelize 6, PostgreSQL, TypeScript,
React, and Wix CLI. It contains a placeholder Wix Dashboard Page but no
visitor-facing custom element or public skin-listing implementation.

The custom element will use the Wix-supported split:

- A native `HTMLElement` widget for the live-site interface.
- A React settings panel for Wix Studio configuration.
- CSS Modules for widget styling.
- Wix CLI-generated extension registration and identifiers.

The installed Wix CLI is currently `1.1.176`. Implementation will upgrade the
development dependency to at least `1.1.192` before scaffolding the extension
through `wix generate --params`. Builder files and extension identifiers will
not be handwritten.

## Confirmed Data Model

Filtering uses the existing tables and relationships:

- `skins`
- `cases`
- `collections`
- `skin_cases`
- `skin_collections`

The implementation will not duplicate case or collection names onto skin rows.
Case and collection filtering will use the existing join tables.

Confirmed live data facts:

- 1,475 skins, 186 cases, and 35 collections.
- No missing or invalid skin float ranges.
- 277 full-range skins and 1,198 float-capped skins.
- No populated `image_url` values.
- Case source types currently include `case`, `operation`, and
  `souvenir_package`.
- The live relationship data contains duplicate and orphaned links.

The schema names used by this specification were verified against the live
database on 11 August 2026. `skins.weapon_name`, `skins.rarity_name`, and
`collections.collection_id` exist exactly as written. The stable identifier
`the_falchion_collection` resolves to `The Falchion Collection`. The live
database remains authoritative; implementation must re-check rather than alter
the schema if documentation and the database ever differ.

The query design will prevent duplicate skin rows and ignore links whose
related case or collection is missing. It will not fabricate missing
relationships or repair source data in this task.

## API Design

### Existing endpoint

`GET /api/skins` remains the only skin-search endpoint. Requests without
filtering or pagination retain the existing successful array response for
compatibility. Filtered or paginated requests use the same endpoint and return
skin arrays with the response header:

```text
X-Total-Count
```

The API does not introduce a JSON envelope solely for pagination. The CORS
configuration exposes the count header to the cross-origin Wix frontend with:

```text
Access-Control-Expose-Headers: X-Total-Count
```

The widget always requests a bounded page and reads the total count rather
than downloading the entire database.

Each filtered skin retains the existing public fields and may add:

- Related collections as stable ID/name pairs.
- Related cases as stable ID/name/source-type objects.
- Authoritatively derived available wear names.

No existing successful field is removed or renamed.

### Filter-options endpoint

`GET /api/skins/filters` returns the values needed to build controls:

- Distinct weapons from `skins.weapon_name`.
- Collection IDs and names from `collections`.
- Case IDs, names, and source types from `cases`.
- Distinct source types from `cases.source_type`.
- Exact rarity values from `skins.rarity_name`.
- The five fixed wear names and their standard boundaries.

This endpoint provides metadata only and is not a competing skin-search
endpoint.

### Query parameters

Supported readable query parameters are:

```text
search
weapon
collection
case
source_type
rarity
stattrak
souvenir
float_min
float_max
wear
limit
offset
```

Multi-select values are comma-separated and correctly URL-encoded. Existing
collection and case IDs are used directly. No new identifier system is
introduced.

Examples:

```text
weapon=AK-47,AWP
rarity=Classified,Covert
collection=the_falchion_collection
source_type=souvenir_package
stattrak=true
float_min=0
float_max=0.07
wear=Factory%20New
```

`limit` is bounded to 1–100 and `offset` must be zero or greater.

### Combination rules

Selections within one filter category use OR logic. Different categories use
AND logic.

Case, collection, and source-type filters use parameterised `EXISTS`
subqueries. This avoids duplicate skin rows despite many-to-many relationships
and duplicate relationship records. All dynamic values are passed through
Sequelize replacements; SQL fragments come only from a fixed allowlist.

### Boolean filters

StatTrak™ and Souvenir each support:

- All: parameter omitted.
- Available: `true`.
- Not available: `false`.

They use the existing `skins.stattrak` and `skins.souvenir` fields.

### Float filtering

`float_min` and `float_max` must be within 0–1. The minimum may not exceed the
maximum. A skin matches when its possible range intersects the requested
closed interval:

```text
skin.max_float >= requested minimum
AND skin.min_float <= requested maximum
```

Supplying only one endpoint applies only that side of the overlap test.

### Wear filtering

Wear is derived from confirmed skin float limits:

- Factory New: `[0.00, 0.07)`
- Minimal Wear: `[0.07, 0.15)`
- Field-Tested: `[0.15, 0.38)`
- Well-Worn: `[0.38, 0.45)`
- Battle-Scarred: `[0.45, 1.00]`

The half-open convention gives exact float values one wear classification.
A skin is available for a selected wear when its possible float interval
intersects that wear interval. Multiple selected wear values use OR logic.
The backend uses the same definitions to filter and to report available wear
names for cards.

For the first four half-open wear intervals `[lower, upper)`, overlap is
implemented as:

```text
skin.max_float >= lower
AND skin.min_float < upper
```

For Battle-Scarred's closed interval `[0.45, 1.00]`, overlap is implemented as:

```text
skin.max_float >= 0.45
AND skin.min_float <= 1.00
```

Therefore a point range whose minimum and maximum are exactly `0.07` matches
Minimal Wear and does not match Factory New. The same inclusion/exclusion rule
applies at `0.15`, `0.38`, and `0.45`. A wider skin range that genuinely spans
a boundary can correctly be available in both neighbouring wear categories.

## Backend Structure

```text
skins/query.js       Parse and validate query parameters.
skins/service.js     Build parameterised list/count/options queries and map rows.
routes/skins.js      Expose skin listing and filter-option HTTP contracts.
app.js               Mount the injected skin router and preserve unrelated routes.
server.js            Construct and inject the production skin service.
```

The legacy `POST /api/skins/filter` route remains available during this change.
No migration, synchronisation, import, or live data mutation is performed.

The current live indexes are limited to table primary keys and composite
`skin_cases(skin_id, case_id)`. The dataset is small enough to establish a
measured baseline before adding indexes. This task will not introduce an index
migration without query-plan evidence showing it is required.

## Widget Structure

Wix CLI will generate the extension under:

```text
src/extensions/site/widgets/skinrush-skin-database/
```

The generated and supporting files have these responsibilities:

```text
skinrush-skin-database.tsx          HTMLElement lifecycle and event delegation
skinrush-skin-database.panel.tsx    Wix Studio settings panel
skinrush-skin-database.module.css   SkinRush visuals and supported responsive rules
skinrush-skin-database.extension.ts Wix-generated registration and sizing
api.ts                              Requests, AbortController, response validation
filter-state.ts                     URL parsing, serialisation, and defaults
render-filters.ts                   Semantic filter controls and active chips
render-results.ts                   Skin cards, grid, breadcrumbs, expanded panel
wear.ts                             Wear labels and card quality-chip presentation
types.ts                            API, filter, and render contracts
```

The generated `src/extensions.ts` registration is retained. Modules will be
split when necessary to keep widget and helper files focused.

## Widget Data Flow

When connected, the widget:

1. Reads filter state from `window.location.search`.
2. Renders the controls and initial results state.
3. Fetches dynamic filter options from `/api/skins/filters`.
4. Requests a bounded result page from `/api/skins`.
5. Replaces only the results region when responses arrive.
6. Registers one delegated event surface plus a `popstate` listener.

Checkbox and select changes request results immediately. Search and float
controls use an approximately 300 ms debounce. Every result request receives
an `AbortController` and sequence number so a stale response cannot replace a
newer one.

Filter changes update readable query parameters without a full page reload.
Browser back/forward events restore controls and results. Widget-owned query
parameters are updated without discarding unrelated page parameters.

`disconnectedCallback` removes listeners, cancels timers, and aborts pending
requests so Wix Studio remounts do not leak work.

## Initial Implementation Defaults

The following choices are practical defaults for the first working Wix preview,
not permanent SkinRush product decisions:

- Search initially matches skin and weapon names.
- The widget initially requests 25 results per page.
- Multiple active collections initially use `Filtered skins` in breadcrumbs.
- Selecting a card initially opens the expanded panel.
- Case and collection context initially use the card placement defined during
  implementation from the supplied visual references.

These defaults can be refined after preview feedback without changing the API,
filter-state architecture, or custom-element boundary.

## User Interface

### Filters

The inline filter area includes:

- Text search.
- Multi-select Weapon.
- Multi-select Collection.
- Multi-select Case.
- Multi-select Source Type.
- Multi-select Rarity.
- StatTrak™ tri-state selection.
- Souvenir tri-state selection.
- Validated minimum and maximum float controls.
- Multi-select Wear.

Active filters appear as individually removable chips. `Clear all` resets the
controls, removes widget filter parameters from the URL, resets pagination,
and requests the unfiltered bounded result page without reloading.

Controls use semantic labels, buttons, inputs, and selected states. All actions
are keyboard accessible and have visible focus treatment.

### Breadcrumbs

The default breadcrumb is `Database → Skins`. A single active collection uses
`Database → <Collection> → Skins`. Selecting a skin initially adds its name.
When several collections are active, the initial middle label is
`Filtered skins`. These labels are preview-stage content defaults.

### Cards and expanded panel

Each card represents one skin and reproduces the supplied visual direction:

- Dark layered card surfaces.
- Cyan and magenta accents.
- Subtle rarity-coloured border treatment.
- Prominent weapon/skin title.
- Status icons for available attributes.
- Related case or collection context.
- All available wear qualities shown on the same card as compact chips.
- A large skin-image area.

Wear chips are non-link controls in this release but are structured so later
work can add hover details, market links, or affiliate destinations without
duplicating cards.

Selecting a semantic card button opens a full-width expanded panel immediately
after the selected card's grid row. The widget recalculates the row insertion
point when its supported container width changes.

The initial expanded panel is structural and uses only authoritative existing
data. Its final information architecture, actions and richer SkinRush
functionality are not locked by this specification.

No additional actions or metadata will be invented to make the initial panel
appear complete.

No unverified price is shown. Because live image URLs are empty, cards use a
finished SkinRush-styled fallback visual rather than a broken image. Populating
authoritative skin images is a separate data task.

### Visual system

The widget uses the confirmed SkinRush identity:

- Page/background: `#0A0014`.
- Supporting dark tones: `#382051` and `#2D1A38`.
- Cyan accent: `#00F0FF`.
- Compact bento/card composition.
- Subtle rarity borders.

The widget does not introduce a separate navigation surface or an iframe-like
frame. Its outer background and spacing integrate with the containing Wix
section.

## Responsive Scope

Desktop and tablet are the only supported layouts for this MVP.

- Large desktop targets five cards per row.
- Column count adapts to available Wix container width across supported desktop
  and tablet sizes.
- Filters remain an inline/desktop-style control surface and reflow only within
  supported desktop and tablet widths.
- Wix container width, rather than viewport assumptions alone, drives grid
  adaptation.
- No mobile drawer is created.
- No phone navigation treatment is created.
- No stacked phone card redesign is created.
- No phone-specific breakpoint is created.

No numerical phone/tablet breakpoint is invented to define the unsupported
range. Supported behaviour is evaluated using the actual Wix desktop/tablet
placement and available component container width.

Below the supported tablet range, the widget preserves content through minimum
sizing and safe overflow where practical. Phone-sized layouts are explicitly
unsupported for the current MVP and are not treated as a failed responsive
requirement.

## Loading, Empty, and Error States

Loading keeps controls and current results visible where safe and adds subtle
progress feedback inside the result area. It does not blank or block the full
widget.

Zero valid matches display:

```text
No skins match these filters.
```

The empty state includes `Clear filters`. It is distinct from failures.

Network, API, or database failures retain the previous safe interface state,
show a retry action, and use a clear generic message. Technical details are
logged for debugging but database messages and stack traces are never shown to
visitors.

## Specialist Metadata

The following are not implemented because no authoritative storage model
exists in the live schema:

- Blue Gem Possible.
- Gold Gem / Reverse Blue.
- Trade-Up → Rare Pattern.
- Collector's Choice.
- Play Skin.
- Limited Edition.
- Craft-Friendly.
- Armoury classification.
- SR Picks.
- Multi-value colour tags.

Float-capped and uncapped classifications are consistently derivable from the
current data, but they are not part of the approved MVP filter list. They can be
added later without modifying source float values.

A future specialist-tag feature should use a flexible many-to-many tag model,
not one boolean column per classification. A future colour feature likewise
requires a multi-value relationship.

## Testing and Verification

Backend tests cover:

- No filters.
- One and multiple weapons.
- One and multiple collections.
- One and multiple cases.
- One and multiple rarities.
- Source types.
- StatTrak™ true and false.
- Souvenir true and false.
- Float minimum, maximum, and interval overlap.
- Every wear category.
- Exact boundaries at `0.07`, `0.15`, `0.38`, and `0.45`, asserting expected
  inclusion in the next range and exclusion from the preceding range.
- Same-category OR and cross-category AND logic.
- Search, pagination, invalid values, and zero results.
- Parameterised SQL replacements.
- Duplicate prevention with many-to-many joins.
- Stable HTTP error responses and unrelated route compatibility.

Frontend state and widget verification covers:

- URL parsing and correctly encoded serialisation.
- Refresh restoration and browser back/forward behaviour.
- Removing one active filter and clearing all filters.
- 300 ms debounce for search and float controls.
- Cancellation and stale-response protection.
- Loading, empty, and error states.
- Keyboard access, labels, focus, and selected states.
- Desktop and tablet grid adaptation.
- Wix container-width behaviour.
- Expanded-panel placement across supported column counts.
- Existing card behaviour and visual regression checks against supplied
  references.

Phone-specific responsive tests and mobile-panel tests are explicitly excluded.

Final validation runs sequentially:

```text
npm install
npm test
npx tsc --noEmit
npx wix build
npx wix preview
```

The preview must be checked at supported desktop and tablet container widths.
Manual Wix Studio placement and sizing instructions will be included in the
implementation handoff.
