# Skinrush API

Backend services for Skinrush, including the skin database, Collections API,
Steam/Wix authentication routes, and CSFloat lookups.

## Requirements

- Node.js 22
- PostgreSQL
- A Render-compatible `DATABASE_URL`

## Local setup

Install dependencies:

```console
npm install
```

Create a local `.env` file. It is ignored by Git and must never be committed.

```dotenv
DATABASE_URL=postgres://user:password@host:5432/database
CSFLOAT_API_KEY=
WIX_CLIENT_ID=
WIX_CLIENT_SECRET=
WIX_API_KEY=
WIX_SITE_ID=
PORT=3000
NODE_ENV=development
```

Start the API:

```console
npm start
```

The default local URL is `http://localhost:3000`.

## Collections API

### Browse collections

```http
GET /api/collections?search=falchion&active=true&limit=24&offset=0
```

Supported query parameters:

- `search`: partial, case-insensitive collection name or ID match.
- `active`: `true` or `false`.
- `limit`: 1 to 100; default 24.
- `offset`: zero or greater; default 0.

Each item includes its stable slug, metadata, linked skin count, and rarity
breakdown.

### Collection detail

```http
GET /api/collections/the_falchion_collection
```

The detail response includes linked skins ordered by Valve rarity and skin
name. Unknown slugs return `COLLECTION_NOT_FOUND` with HTTP 404.

## Skins API

The existing unfiltered endpoint remains compatible and returns the complete
skin array:

```http
GET /api/skins
```

Providing any supported query parameter enables server-side filtering and
pagination while keeping the response body as a skin array. The total number of
matching skins is returned in the `X-Total-Count` response header, which is
exposed to approved cross-origin Wix clients.

Supported query parameters:

- `search`: partial, case-insensitive skin or weapon name match.
- `weapon`, `collection`, `case`, `source_type`, `rarity`, `wear`:
  comma-separated multi-select values.
- `stattrak`, `souvenir`: `true` or `false`.
- `float_min`, `float_max`: values from 0 to 1 using range overlap semantics.
- `limit`: 1 to 100; default 25.
- `offset`: zero or greater; default 0.

Selections within one category use OR; selections across categories use AND.
Wear filters use the standard half-open CS wear ranges, with Battle-Scarred
including 1.00. For example:

```http
GET /api/skins?weapon=AK-47%2CAWP&rarity=Classified&wear=Factory%20New&limit=25
```

Available authoritative filter values are returned in one response:

```http
GET /api/skins/filters
```

The legacy `POST /api/skins/filter` weapon filter remains available for its
existing consumers.

## Tests

The test suite does not require access to Render or PostgreSQL:

```console
npm test
```

## Database export validation

Validate the five CSV exports before importing or changing the live database:

```console
npm run validate:data -- "D:\skinrush-api-database-files"
```

The validator checks:

- Required CSV columns.
- Duplicate skin, collection, and case IDs.
- Duplicate skin-to-collection and skin-to-case links.
- Links to missing skins, collections, or cases.
- Literal `NULL` values that must become database nulls.

A non-zero exit code means the exports are unsafe to import. The command prints
grouped error counts and bounded samples so the source data can be repaired.

## Wix development

The Wix app commands remain available:

```console
npm run dev
npm run build
```
