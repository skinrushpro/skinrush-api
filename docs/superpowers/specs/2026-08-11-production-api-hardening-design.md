# Production API Hardening Design

## Goal

Harden the public Skinrush API without changing successful client responses or
removing the database diagnostic used during operations.

## Scope

- Keep `GET /api/test-db` available for manual diagnostics.
- Prevent database and ORM error details from reaching public clients.
- Use one CORS policy for the production site and supported Wix origins.
- Add automated contract coverage for the changed behavior.
- Preserve the Collections API and all successful existing route responses.

Authentication changes, rate limiting, database migrations, data cleanup, and
frontend work are outside this change.

## API Behavior

### Database diagnostic

`GET /api/test-db` will call `sequelize.authenticate()` as it does today.

- Success remains HTTP 200 with `{ "success": true, "message": "Database connected successfully" }`.
- Failure becomes HTTP 503 with `{ "success": false, "error": "Database unavailable" }`.
- The detailed failure remains in the server log for Render diagnostics.

The 503 status identifies a temporary dependency outage without exposing a
database name, host, query, or driver message.

### Skins failure

`GET /api/skins` will keep its successful response unchanged. On failure it
will return HTTP 500 with `{ "error": "Failed to fetch skins" }`. Detailed ORM
errors remain server-side only.

### CORS

Express will use a single CORS middleware configured from the existing
allowlist:

- `https://www.skinrush.pro`
- `https://editor.wix.com`
- `https://preview.wixsite.com`

Requests without an `Origin` header remain supported for server-to-server and
diagnostic clients. Allowed browser origins receive the matching
`Access-Control-Allow-Origin` header and credential support. Unknown origins do
not receive an allow-origin header. Preflight requests use the same policy.

## Structure

The change stays in `app.js` and `test/app.test.js`. A small CORS origin
function will replace the current fixed-origin middleware plus manual header
middleware. Route dependencies continue to be injected through `createApp`, so
tests can exercise real HTTP responses with deterministic fakes.

## Testing

Tests will be written before production changes and will cover:

- database diagnostic success;
- database diagnostic failure returning 503 without the underlying message;
- skins failure without the underlying ORM message;
- production and Wix origins receiving their own allow-origin header;
- an unknown origin receiving no allow-origin header;
- preflight behavior using the same allowlist.

The focused app contract tests will be run during each red-green cycle. The
complete `npm test` suite will be run after integration. The final diff will be
reviewed for secrets, unrelated changes, and accidental API changes.

## Deployment and Verification

The implementation will be committed locally but not pushed or deployed
without an explicit user request. After deployment, read-only smoke checks
should cover `/api/hello`, `/api/test-db`, `/api/collections`, an invalid
collection query, and an unknown collection slug with a production `Origin`
header.
