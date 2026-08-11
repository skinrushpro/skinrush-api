# Collections API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the Phase 1 Collections API against the supplied Skinrush data contract.

**Architecture:** Separate Express app creation from process startup, inject a collection service into the router for contract testing, and keep Sequelize-specific aggregation in the service. Model the existing many-to-many schema without synchronising or mutating the live database.

**Tech Stack:** Node.js 22, Express 4, Sequelize 6, PostgreSQL, Node's built-in test runner.

## Global Constraints

- Preserve existing `/api/auth`, `/api/members`, `/api/steam`, `/api/skins`, `/api/item`, and `/api/skins/filter` behaviour.
- Do not connect to, migrate, import into, or otherwise modify the live Render database.
- Keep Valve rarity names and colours unchanged.
- Use string IDs from the exports exactly as supplied.

---

### Task 1: Testable application boundary

**Files:**
- Create: `app.js`
- Create: `test/app.test.js`
- Modify: `server.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createApp({ collectionService })`, returning an Express application.

- [ ] Write an HTTP contract test for the existing health endpoint.
- [ ] Run the test and confirm it fails because `createApp` does not exist.
- [ ] Extract app construction from `server.js` and keep the listener in `server.js`.
- [ ] Run the focused test and confirm it passes.

### Task 2: Data models and associations

**Files:**
- Create: `models/Collection.js`
- Create: `models/SkinCollection.js`
- Create: `test/models.test.js`
- Modify: `models/Skin.js`

**Interfaces:**
- Produces: `Skin`, `Collection`, and `SkinCollection` Sequelize models with string primary and foreign keys.

- [ ] Write model-contract tests for table names, field names, string identifiers, and associations.
- [ ] Run the tests and confirm the missing models and integer skin ID fail.
- [ ] Implement the models and associations without database synchronisation.
- [ ] Run the focused model tests and confirm they pass.

### Task 3: Collection query contract

**Files:**
- Create: `collections/query.js`
- Create: `test/collections-query.test.js`

**Interfaces:**
- Produces: `parseCollectionQuery(query)` returning validated `search`, `active`, `limit`, and `offset` values.

- [ ] Write tests for defaults, trimmed search, booleans, integer bounds, and rejected malformed input.
- [ ] Run the tests and confirm the module is missing.
- [ ] Implement the minimal parser and typed validation error.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Collection service

**Files:**
- Create: `collections/service.js`
- Create: `test/collections-service.test.js`

**Interfaces:**
- Produces: `createCollectionService({ Collection, Skin })` with `list(query)` and `getBySlug(slug)`.

- [ ] Write service tests using deterministic model fakes for mapped summaries, rarity counts, pagination, detail skins, and missing collections.
- [ ] Run the tests and confirm the service is missing.
- [ ] Implement Sequelize query construction and response mapping.
- [ ] Run the focused tests and confirm they pass.

### Task 5: Collections HTTP endpoints

**Files:**
- Create: `routes/collections.js`
- Modify: `app.js`
- Modify: `test/app.test.js`

**Interfaces:**
- Consumes: injected collection service.
- Produces: `GET /api/collections` and `GET /api/collections/:slug`.

- [ ] Write endpoint tests for success, invalid query, not found, and internal failure.
- [ ] Run the tests and confirm the routes return 404.
- [ ] Implement the router and mount it in the app.
- [ ] Run the endpoint tests and confirm they pass.

### Task 6: CSV validation

**Files:**
- Create: `scripts/validate-database-files.js`
- Create: `test/database-files.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateDatabaseFiles(directory)` and `npm run validate:data -- <directory>`.

- [ ] Write fixture-based tests for valid exports, literal `NULL` normalisation, duplicate IDs, duplicate links, and orphan links.
- [ ] Run the tests and confirm the validator is missing.
- [ ] Implement a standards-compliant CSV reader and validation report.
- [ ] Run validation against `D:\skinrush-api-database-files` and confirm all reported issues are actionable.

### Task 7: Broad verification and documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents local tests, data validation, environment variables, and Collections API examples.

- [ ] Run the complete test suite.
- [ ] Run the data validator against the supplied exports.
- [ ] Start the API without a live database and exercise the health endpoint.
- [ ] Review the final diff for secrets, generated noise, and unintended route changes.
- [ ] Record any live-PostgreSQL checks as unverified until a local `DATABASE_URL` is provided.

