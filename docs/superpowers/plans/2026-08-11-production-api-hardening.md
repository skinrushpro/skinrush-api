# Production API Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent public database error disclosure and make browser CORS behavior consistent without changing successful API responses.

**Architecture:** Keep application construction in `createApp` and verify behavior through real ephemeral HTTP servers. Replace the two overlapping CORS implementations with one callback-based allowlist, then sanitize dependency failures at the route boundary while retaining detailed server logs.

**Tech Stack:** Node.js 22, Express 4, `cors` 2, Node's built-in test runner.

## Global Constraints

- Keep `GET /api/test-db` available for manual diagnostics.
- Preserve successful response bodies for `/api/test-db`, `/api/skins`, and the Collections API.
- Never expose database, Sequelize, host, query, or driver error details to clients.
- Allow `https://www.skinrush.pro`, `https://editor.wix.com`, and `https://preview.wixsite.com` with credentials.
- Continue accepting requests without an `Origin` header.
- Unknown browser origins must not receive `Access-Control-Allow-Origin`.
- Do not add dependencies, authentication, rate limiting, migrations, data changes, or frontend changes.

---

### Task 1: Single CORS allowlist

**Files:**
- Modify: `test/app.test.js`
- Modify: `app.js`

**Interfaces:**
- Consumes: `createApp(options)` and the request `Origin` header.
- Produces: one `corsOptions.origin(origin, callback)` policy shared by normal and preflight requests.

- [ ] **Step 1: Write failing CORS contract tests**

Add tests that issue real HTTP requests through `startApp()`:

```js
for (const origin of [
  'https://www.skinrush.pro',
  'https://editor.wix.com',
  'https://preview.wixsite.com'
]) {
  test(`CORS allows ${origin}`, async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/api/hello`, {
      headers: { Origin: origin }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });
}

test('CORS omits allow-origin for unknown browser origins', async () => {
  const baseUrl = await startApp();
  const response = await fetch(`${baseUrl}/api/hello`, {
    headers: { Origin: 'https://attacker.example' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('CORS preflight uses the Wix allowlist', async () => {
  const baseUrl = await startApp();
  const response = await fetch(`${baseUrl}/api/collections`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://editor.wix.com',
      'Access-Control-Request-Method': 'GET'
    }
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://editor.wix.com'
  );
});
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run:

```console
node --test test/app.test.js
```

Expected: the unknown-origin assertion sees the fixed production origin, and the Wix preflight assertion sees the wrong origin.

- [ ] **Step 3: Replace overlapping CORS middleware with one policy**

In `app.js`, define the allowlist before `corsOptions`, use a callback origin policy, and remove the manual header middleware:

```js
const allowedOrigins = new Set([
  'https://www.skinrush.pro',
  'https://editor.wix.com',
  'https://preview.wixsite.com'
]);

const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};
```

Keep only `app.use(cors(corsOptions))`; the package handles matching preflight requests through the same policy.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```console
node --test test/app.test.js
```

Expected: all app contract tests pass.

- [ ] **Step 5: Commit the CORS slice**

```console
git add app.js test/app.test.js
git commit -m "Harden API CORS policy"
```

### Task 2: Sanitize database-backed route failures

**Files:**
- Modify: `test/app.test.js`
- Modify: `app.js`

**Interfaces:**
- Consumes: injected `sequelize.authenticate()` and `Skin.findAll()` collaborators.
- Produces: stable public failure responses while retaining detailed `console.error` logs.

- [ ] **Step 1: Write failing diagnostic and skins failure tests**

Add these real HTTP contract cases, using the test context mock to keep expected server logs out of test output:

```js
test('GET /api/test-db reports database availability', async () => {
  const sequelize = { authenticate: async () => {} };
  const baseUrl = await startApp({ sequelize });
  const response = await fetch(`${baseUrl}/api/test-db`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: 'Database connected successfully'
  });
});

test('GET /api/test-db hides database failure details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const sequelize = {
    authenticate: async () => {
      throw new Error('database "private_name" does not exist');
    }
  };
  const baseUrl = await startApp({ sequelize });
  const response = await fetch(`${baseUrl}/api/test-db`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    success: false,
    error: 'Database unavailable'
  });
});

test('GET /api/skins hides ORM failure details', async (t) => {
  t.mock.method(console, 'error', () => {});
  const Skin = {
    findAll: async () => {
      throw new Error('relation private_schema.skins does not exist');
    }
  };
  const baseUrl = await startApp({ Skin });
  const response = await fetch(`${baseUrl}/api/skins`);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Failed to fetch skins' });
});
```

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Run:

```console
node --test test/app.test.js
```

Expected: the database failure test receives status 500 and the detailed driver message; the skins failure response contains a `details` field.

- [ ] **Step 3: Implement minimal response sanitization**

Change only the two catch blocks in `app.js`:

```js
console.error('DB connection error:', error.message);
res.status(503).json({ success: false, error: 'Database unavailable' });
```

```js
console.error('Failed to fetch skins:', error);
res.status(500).json({ error: 'Failed to fetch skins' });
```

- [ ] **Step 4: Run focused and complete verification**

Run:

```console
node --test test/app.test.js
npm.cmd test
git diff --check
git status --short
```

Expected: all app tests pass, all project tests pass with zero failures, the diff has no whitespace errors, and only intended plan/application/test files are present.

- [ ] **Step 5: Review and commit the hardening slice**

Review:

```console
git diff -- app.js test/app.test.js
```

Confirm there are no secrets, dependency changes, route removals, or successful-response changes. Then commit:

```console
git add app.js test/app.test.js docs/superpowers/plans/2026-08-11-production-api-hardening.md
git commit -m "Sanitize API database errors"
```

### Task 3: Post-implementation handoff

**Files:**
- No production files changed.

**Interfaces:**
- Consumes: committed implementation and passing local verification.
- Produces: deploy instructions and a bounded live smoke-test checklist.

- [ ] **Step 1: Inspect final repository state**

Run:

```console
git status --short --branch
git log -3 --oneline --decorate
```

Expected: the worktree is clean and the local branch is ahead of `origin/main` by the hardening commits.

- [ ] **Step 2: Report the deploy boundary**

Do not push or deploy automatically. Tell the user to push the commits, wait for Render to report `Deployed`, and then request live verification of:

```text
GET /api/hello
GET /api/test-db
GET /api/collections?limit=1
GET /api/collections?limit=0
GET /api/collections/not-a-real-collection
```

The browser-facing checks must include `Origin: https://www.skinrush.pro` and confirm the matching allow-origin header.
