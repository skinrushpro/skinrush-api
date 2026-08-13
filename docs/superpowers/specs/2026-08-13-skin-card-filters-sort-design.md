# SkinRush Card, Multi-Select, and Sorting Correction Design

## Goal

Correct the existing SkinRush database widget after Wix preview without
changing its architecture. The result cards will reproduce the approved card
hierarchy, the six list filters will become true multi-select checkbox
popovers, and sorting will be performed by the existing `/api/skins` backend
before pagination.

This is a targeted correction to the existing public database experience. It
does not redesign navigation, authentication, profiles, unrelated Wix pages,
or the expanded-panel information architecture.

## Authoritative Inputs

The supplied SkinRush card screenshots define the visual hierarchy. The live
database and current API schema define what may be displayed. Missing data is
never fabricated.

Confirmed schema fields used by this change include:

- `skins.skin_id`
- `skins.skin_name`
- `skins.weapon_name`
- `skins.rarity_name`
- `skins.rarity_color`
- `skins.min_float`
- `skins.max_float`
- `skins.stattrak`
- `skins.souvenir`
- `skins.image_url`
- `skins.description`

Case and collection relationships continue to use `skin_cases`, `cases`,
`skin_collections`, and `collections`. Duplicate and orphan relationship
records retain the existing safe handling. This work does not repair source
data or populate missing images or skins.

The live rarity values were inspected on 13 August 2026. Their ascending game
order is:

1. Consumer Grade
2. Industrial Grade
3. Mil-Spec Grade
4. Restricted
5. Classified
6. Covert
7. Extraordinary

No additional live rarity values require special handling. `Extraordinary` is
highest and `Consumer Grade` is lowest.

## Scope

This change includes:

- Approved card-face hierarchy and proportions.
- Conditional status icons backed by authoritative fields.
- Human-readable wear-span text.
- A visual, non-interactive 0–1 float-range bar.
- Conservative source-selection and source-filter behaviour.
- A large transparent-artwork region with the existing fallback when needed.
- Correct database breadcrumbs.
- Safe rendering for the description formatting currently stored.
- Checkbox-popover multi-select controls for Weapon, Collection, Case, Source
  Type, Rarity, and Wear.
- A results-header Sort by control.
- Backend sorting, search relevance, URL restoration, and stable pagination.

This change explicitly excludes:

- Steam prices, Steam icons, dummy prices, and price rows.
- Case thumbnails, case-image placeholders, or additional image regions.
- Price, popularity, trending, random, value, or SkinRush Pick sorting.
- Fabricated Armoury or SkinRush Pick classifications.
- A substantial expanded-panel redesign.
- Phone-specific layouts or controls.

The only primary visual image region is the large skin-artwork layer.

## Card Face

### Required hierarchy

Each visible card face is ordered as:

1. Raised `Weapon | Skin Name` title plate.
2. Compact, centred conditional status-icon strip.
3. Human-readable available wear span.
4. Visual actual float-range bar.
5. Raised authoritative source plate or quiet missing/multiple state.
6. Large artwork layer capable of extending towards or beyond the card edges
   and below the conventional content region.

The card does not display a rarity dot or rarity name row, textual StatTrak™ or
Souvenir labels, individual FN/MW/FT/WW/BS chips, or a permanent collection
label at the bottom. Rarity remains visible through the subtle existing
rarity-coloured border.

### Status icons

The reserved icon order and meaning are:

1. Green circular icon: Armoury.
2. Orange bars icon: StatTrak™.
3. Yellow icon: Souvenir.
4. Pink star: SkinRush Pick.

Only icons backed by authoritative data render. The current `stattrak` and
`souvenir` fields support the second and third icons. Armoury and SkinRush Pick
do not render until authoritative fields exist. Hidden icons consume no visible
space; the remaining icons stay centred.

Tooltips are:

- Armoury: `Available from the Armoury`
- StatTrak™: `Available as StatTrak™`
- Souvenir: `Available as a Souvenir skin`

The labels are available on hover and keyboard focus and are not permanently
shown beside the icons. Icons use accessible names without duplicating visible
text.

### Wear span and float bar

The wear span is derived from the existing authoritative `availableWears`
order. It shows the first and last available full wear names separated by an
arrow, for example `Factory New → Battle-Scarred`. If exactly one wear is
available, it appears once. Missing wear data receives a quiet `Wear
unavailable` treatment rather than invented values.

The float bar sits directly below the wear span. Its track represents 0–1 and
its active interval begins at `min_float × 100%` and ends at `max_float ×
100%`. It displays the authoritative numeric range using sufficient precision
to avoid turning a capped interval into an apparent full interval. It is not a
filter, slider, or draggable control.

### Source selection

The card source follows this conservative rule:

- Exactly one valid linked case: display its name as a Case-filter button.
- Multiple valid linked cases: display non-clickable `Multiple sources`.
- No case and exactly one valid linked collection: display its name as a
  Collection-filter button.
- No case and multiple valid linked collections: display non-clickable
  `Multiple collections`.
- No valid relationship: display quiet `Source unavailable`.

No relationship is selected alphabetically or by array position. Stable order
is not treated as authoritative primary-source data.

For multiple relationships, the state label is a focusable, non-action element
with an `aria-describedby` tooltip containing every linked name. The same
tooltip appears on hover and keyboard focus, and the names remain available in
the expanded panel. The disclosure does not label any relationship as primary.

Clicking a valid source button applies that Case or Collection filter, resets
pagination, updates URL state, requests results without a Wix reload, and does
not also open the skin details. Event handling must distinguish the nested
source action from card selection. The source button uses restrained cyan
hover and focus feedback.

### Artwork

The artwork layer supports large transparent weapon imagery with preserved
aspect ratio and `object-fit: contain`. It is not constrained to a square
thumbnail. Controlled overflow allows artwork to extend towards or beyond the
card edges and below the conventional content region without interfering with
adjacent cards or controls.

Until `image_url` is populated, the current polished SkinRush fallback renders
inside this same final artwork region. Adding an authoritative image later
requires data population only, not card restructuring.

## Expanded Panel and Description Safety

The expanded panel remains structural and uses only authoritative existing
data. Its actions, richer functionality, and final information architecture
remain outside this correction.

Descriptions may contain line breaks and limited source markup such as
`<i>…</i>`. Rendering supports only the formatting actually confirmed in the
source data:

- Normalize `\r\n`, `\n\r`, `\r`, and `\n` into safe line breaks.
- Preserve emphasis represented by `<i>` and `</i>` as semantic `<em>`.
- Escape all text and all other tags or attributes.
- Never insert raw database content through unsanitized `innerHTML`.

Multiple linked case and collection names are listed without assigning a
primary relationship.

## Breadcrumbs

The default breadcrumb is:

```text
DATABASE > SKINS
```

When exactly one collection is active, it is:

```text
DATABASE > [Collection Name] > SKINS
```

When multiple collections are active, the middle label is `FILTERED SKINS` as
an implementation default. No collection context is implied when none is
active.

## Multi-Select Filters

Weapon, Collection, Case, Source Type, Rarity, and Wear become custom
button-triggered popovers containing checkbox options. They retain the current
compact closed-control appearance and do not use native multi-select list
boxes.

Each control provides:

- A visible label and semantic trigger button.
- An accessible popup relationship and expanded state.
- Checkbox options with selected state restored from the URL.
- A concise closed summary: `Any weapon` when empty, the selected label for
  one value, and `[n] selected` for multiple values.
- Keyboard operation for opening, moving through options, toggling values,
  Escape to close, and returning focus to the trigger.
- Outside-click dismissal without discarding selections.

Selections within one category remain OR conditions; different categories
remain AND conditions. Each checkbox change applies immediately, resets offset
to zero, updates existing array-based URL state, and requests new results.
Active-filter chips and individual removal continue to work.

StatTrak™ and Souvenir remain ordinary tri-state controls: Any, Available, and
Not available. Search and float filtering retain their existing behaviour.

`Clear all` clears search and filter conditions but preserves the selected
sort. It resets pagination and requests the unfiltered first page without a
reload.

## Sort By

### Frontend

`Sort by` is a compact labelled select in the results header, visually grouped
with the result count:

```text
Skin database                    1,475 skins    Sort by [Weapon A–Z]
```

At supported tablet container widths the count and control may wrap cleanly.
Sort is presentation state, not a filter, so it never appears as an active
filter chip.

Supported labels and stable URL values are:

| Label | `sort` value |
| --- | --- |
| Weapon A–Z | `weapon_asc` |
| Skin name A–Z | `name_asc` |
| Rarity: highest first | `rarity_desc` |
| Rarity: lowest first | `rarity_asc` |
| Lowest minimum float | `float_min_asc` |
| Highest maximum float | `float_max_desc` |

The default is `weapon_asc`. A missing parameter displays the default without
writing it immediately. An invalid value follows the existing strict query
validation convention and returns a safe `400` response.

Changing sort updates local and URL state, resets offset to zero, and requests
new results immediately. Filter changes preserve sort. Refresh, shared URLs,
browser back, and browser forward restore it. Existing cancellation and
sequence protection prevent stale results from overwriting a newer sort.

### Backend ordering

Sorting extends the existing `GET /api/skins`; there is no new endpoint and no
client-side full-dataset sorting. A fixed allowlist maps URL values to fixed SQL
fragments. Raw URL values are never used as SQL identifiers or directions.

All orderings occur before `LIMIT` and `OFFSET`:

- `weapon_asc`: `s.weapon_name ASC, s.skin_name ASC, s.skin_id ASC`
- `name_asc`: `s.skin_name ASC, s.weapon_name ASC, s.skin_id ASC`
- `rarity_desc`: explicit rarity rank descending, then weapon, name, and ID
- `rarity_asc`: explicit rarity rank ascending, then weapon, name, and ID
- `float_min_asc`: `s.min_float ASC`, then weapon, name, and ID
- `float_max_desc`: `s.max_float DESC`, then weapon, name, and ID

The rarity rank is a fixed `CASE` expression containing only the seven verified
live values in the confirmed hierarchy. The unique skin ID is the final
deterministic tie-breaker for every ordering.

When search is present, a fixed relevance expression precedes the selected
sort:

1. Exact skin-name match.
2. Skin name starts with the search term.
3. Exact weapon-name match.
4. Weapon name starts with the search term.
5. Skin name contains the search term.
6. Weapon name contains the search term.

Comparisons are case-insensitive. The selected sort follows relevance as the
secondary ordering, and the unique ID remains the final tie-breaker.

## State and Compatibility

`FilterState` gains a typed sort value. URL parsing, serialization, controller
updates, clear behaviour, pagination, source clicks, and popstate restoration
use the same state pipeline. The current `/api/skins` array response and
`X-Total-Count` header remain unchanged.

The change must preserve:

- Filter API compatibility.
- Pagination and counts.
- Loading, empty, and error states.
- URL state and unrelated query parameters.
- Browser back and forward.
- Debounced search and float inputs.
- Request cancellation and stale-response protection.
- Card selection and expanded-row placement.
- Desktop/tablet container-driven adaptation.
- Keyboard accessibility and visible focus.

## Visual and Responsive Requirements

The existing SkinRush palette remains:

- Background: `#0A0014`
- Supporting dark tones: `#382051` and `#2D1A38`
- Cyan accent: `#00F0FF`
- Subtle rarity-coloured card borders

Large desktop targets five cards per row. Grid columns adapt to the available
Wix container width across supported desktop and tablet placements. No
phone-specific breakpoint, drawer, navigation, or stacked card redesign is
introduced. Below supported tablet width, safe minimum sizing and overflow are
preserved without claiming phone support.

## Verification

Backend tests cover:

- Default sorting and every supported sort value.
- Strict rejection of an invalid sort.
- Filtering plus sorting.
- Search relevance plus secondary sorting.
- Pagination after sorting and deterministic ties.
- Exact same URL producing the same order.
- Confirmed rarity hierarchy in both directions.
- Minimum- and maximum-float ordering.
- Ordering before `LIMIT` and `OFFSET`.

Frontend state and rendering tests cover:

- Default sort display and all sort selections.
- Sort URL serialization, refresh restoration, and popstate restoration.
- Offset reset after sort or source-filter changes.
- Sort persistence when filters change and when Clear all is used.
- Checkbox-popover multi-selection and closed summaries.
- Keyboard operation, accessible names, tooltips, and focus states.
- Source-selection rules, source filter actions, and non-primary multiple
  relationship states.
- Correct default and single-collection breadcrumbs.
- Title plate, conditional icon strip, wear span, positioned float bar, source
  plate, artwork region, and rarity border.
- Safe supported-description rendering and escaping of unsupported markup.
- Existing loading, empty, error, history, and stale-request behaviour.

After automated tests and a successful Wix build, verification uses the Wix
test/live site because Wix Studio disables network APIs inside the editor's
custom-element sandbox. At the same large-desktop container width as the
reference, the final comparison checks:

- Five-card row and card proportions.
- Title plate.
- Status icons and tooltips.
- Wear span and correctly positioned float interval.
- Source plate, source hover/focus disclosure, and source click behaviour.
- Artwork scale and overflow.
- Rarity border.
- Correct breadcrumb.
- Multi-select behaviour.
- Sort placement and stable result ordering.

Remaining visual differences are reported explicitly; exact parity is not
claimed unless the comparison demonstrates it.
