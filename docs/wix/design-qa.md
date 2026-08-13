# SkinRush Native Wix Repeater Design QA

Date: 2026-08-13

Status: native Wix visual/interaction QA remains blocked after deployment

## Completed

- The final native repeater is `#skinDatabaseCardsRepeater`.
- The custom element is `#skinRushSkinDatabase1`.
- The exact repository adapter in `docs/wix/skin-database-page-adapter.js` was installed in `src/pages/Skin Database.upkkz.js` in Wix IDE.
- Wix IDE reported zero code problems after installation.
- The site was synced with Wix Studio.
- Wix test mode ran the Skin Database page code.
- The adapter contains no `/api/skins` request, filtering, sorting, pagination, search, URL, or history implementation.
- The existing CSS result renderer remains enabled until the native repeater passes QA.
- No Wix publish action was used.
- Render successfully deployed commits `18517bd` and `b27ce0f` by exact SHA.
- Wix app test version `1.6.0` was created; the public Wix site was not published.
- Production smoke tests passed for the public array response, `X-Total-Count`,
  existing SkinRush origins, and the exact approved Wix development origin.

## Blocking findings

The API/CORS blocker is resolved. The deployed allowlist contains only the exact
approved origin:

`https://99b1b14d-b61d-4c75-b149-c3899470677a.dev.wix-code.com`

The first post-deployment browser run confirmed the custom-element controller
loaded the 1,475-record catalogue, but the native repeater still showed its
design-time FAMAS samples. The emitted event was traced to the React shadow
content rather than the custom-element host. Commit `b27ce0f` moves dispatch to
the host and adds a regression test; Wix test version `1.6.0` contains that fix.

The local browser automation connection reset during the long Render deployment
wait, and the Windows fallback could not attach because of a local permission
error. Consequently, the required post-1.6.0 desktop/tablet screenshots and
native interaction checks could not be completed in this run. The legacy CSS
renderer remains enabled by design until this final proof is obtained.

## Verification completed locally

- Full tests: 117 passed, 0 failed.
- TypeScript: no errors.
- Wix app build: passed.
- Public API: `/api/skins` returned 200 with `X-Total-Count: 1475`.
- Public API: `Access-Control-Expose-Headers: X-Total-Count` is present.
- Public API: `/api/skins/filters` returned 200.
- Exact Wix development-origin CORS: passed locally and against production.
- Other Wix tenants, HTTP, malformed, insecure and lookalike origins: rejected.

## Deferred until browser QA can resume

- Confirm native result data reaches the repeater.
- Confirm card selection and selected-state restoration.
- Confirm single-case and single-collection source actions.
- Confirm multiple/missing sources remain non-actionable.
- Confirm filter, sort, pagination, and back/forward updates.
- Confirm StatTrak and Souvenir icon states.
- Confirm Armoury, trade-up signal, and pricing remain collapsed.
- Compare the native card directly with the original Wix asset.
- Capture desktop and tablet screenshots.
- Decide whether the CSS result renderer can be disabled.

## Current visual limitations to verify

- The API currently returns empty artwork URLs for the sampled records. The
  adapter does not fabricate artwork and collapses the image when none exists.
- Wix's native `#floatNumberContainer` is preserved. Its arbitrary proportional
  interval cannot be changed through the confirmed native container API without
  restructuring the Wix asset; only the authoritative numeric range is bound.
- Typography must be checked from computed rendering in the test environment,
  not inferred from CSS declarations.

## Security assessment

1. New attack surface: a narrow command attribute and results event across the
   existing Wix/custom-element boundary, plus the Wix development CORS origin.
2. User-controlled input: command JSON, filter values, URL state, and card/source
   interactions; all commands are allowlisted and validated.
3. Browser-visible data: only current public catalogue page fields required by
   the native card. No user/private data was added.
4. Authentication requirement: none for the public catalogue route.
5. Additional authorisation: none; no private resource is exposed.
6. IDOR/BOLA: no user-owned resource or client-supplied ownership claim exists
   in this migration.
7. SQL: existing parameterised server-side filter pipeline is reused; the Wix
   adapter contains no database query or API client.
8. Response minimisation: bridge items are explicitly mapped rather than passing
   arbitrary database rows.
9. Secrets: none are present in the adapter, bridge, attributes, or payloads.
10. Errors: public-safe error state is retained; no stack, SQL, or credentials
    are exposed.
11. Duplication: no second API/filter/sort state pipeline was introduced. The
    legacy CSS renderer is temporarily retained solely for migration safety.
12. Abuse/enumeration: bounded existing pagination is retained. The new CORS
    allowance is one exact HTTPS origin rather than a wildcard or suffix rule.

## Separate security-hardening follow-up

The existing global acceptance of `Origin: null` while CORS credentials remain
enabled is outside this migration and has not been changed. Before SkinRush
introduces or relies on cookie-authenticated private Steam, user, account, or
inventory routes, review CORS per route and data sensitivity. In particular,
decide whether opaque origins should remain accepted at all and keep the public
catalogue policy separate from future private-data trust decisions.
