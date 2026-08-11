# Collections API Design

## Goal

Deliver a reliable read-only Collections API backed by the existing PostgreSQL tables and compatible with the supplied CSV exports.

## Scope

- Correct the `skins.skin_id` Sequelize type from integer to string.
- Model `collections` and the `skin_collections` join table.
- Expose collection list and detail endpoints under `/api/collections`.
- Include search, active-state filtering, pagination, skin counts, rarity breakdowns, and linked skins.
- Add deterministic tests that do not require access to the live Render database.
- Add a CSV validation command that checks IDs, duplicate links, orphan links, and null normalisation before any live import.

Armoury, case browsing, price data, authentication, and trade-up calculations are outside this slice.

## Data Contract

`skins.skin_id`, `collections.collection_id`, and both join-table foreign keys are strings. Collection IDs such as `the_falchion_collection` are stable slugs and are used directly by `GET /api/collections/:slug`.

CSV values equal to `NULL` (case-insensitive) are treated as database nulls. Boolean values accept `true` and `false` case-insensitively. Invalid values fail validation rather than being silently coerced.

The relationship is many-to-many because the export contains more skin-collection links than skins. Duplicate join rows are invalid. Every join row must refer to an existing skin and collection.

## API Contract

### `GET /api/collections`

Query parameters:

- `search`: case-insensitive partial match against collection name or ID.
- `active`: `true` or `false`; omitted means all collections.
- `limit`: integer from 1 to 100, default 24.
- `offset`: non-negative integer, default 0.

Response:

```json
{
  "items": [
    {
      "id": "the_falchion_collection",
      "slug": "the_falchion_collection",
      "name": "The Falchion Collection",
      "releaseDate": null,
      "sourceType": null,
      "operationName": null,
      "isActive": true,
      "skinCount": 16,
      "rarityBreakdown": { "Mil-Spec Grade": 7 }
    }
  ],
  "pagination": { "limit": 24, "offset": 0, "total": 35 }
}
```

Invalid query values return HTTP 400 with a stable `INVALID_QUERY` error code. Database failures return HTTP 500 without exposing credentials or SQL details.

### `GET /api/collections/:slug`

Returns the same collection summary plus `skins`, ordered by rarity and skin name. Each skin includes its ID, name, weapon, rarity, rarity colour, floats, image URL, StatTrak and Souvenir flags. An unknown slug returns HTTP 404 with `COLLECTION_NOT_FOUND`.

## Architecture

Route handlers validate HTTP input and format errors. A collection service owns query construction and response mapping. Sequelize models own table and association definitions. The Express app is exported separately from the listener so endpoint tests can run on an ephemeral local port with an injected service.

## Verification

- Unit tests cover query parsing and CSV validation.
- API contract tests start the real Express app and exercise list, detail, invalid-query, not-found, and internal-error responses.
- Model tests verify string identifiers and table mappings without connecting to PostgreSQL.
- The full test command must pass without `DATABASE_URL`.

