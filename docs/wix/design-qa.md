# SkinRush Native Wix Repeater Design QA

Date: 2026-08-13

Status: blocked before live card QA

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
- No Render deployment was performed.

## Blocking finding

Wix test mode executes the page/widget from a generated origin matching:

`https://<site-instance>.dev.wix-code.com`

The currently deployed Render API does not return `Access-Control-Allow-Origin`
for that origin, so the browser blocks the otherwise successful skin response.
The widget consequently remains in its safe API error state and cannot emit live
result items to the native repeater.

A narrow repository fix has been prepared and tested. It permits only HTTPS
hosts ending in `.dev.wix-code.com`, while continuing to reject insecure and
lookalike origins. Deploying that change to Render requires explicit approval.

## Verification completed locally

- Full tests: 115 passed, 0 failed.
- TypeScript: no errors.
- Wix app build: passed.
- Public API: `/api/skins` returned 200 with `X-Total-Count: 1475`.
- Public API: `Access-Control-Expose-Headers: X-Total-Count` is present.
- Public API: `/api/skins/filters` returned 200.
- Wix development-origin CORS test: passes locally after the narrow fix.
- Insecure and lookalike Wix development origins: rejected by tests.

## Deferred until the approved Render test deployment

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
    allowance is suffix- and protocol-validated rather than a wildcard.

## Separate security-hardening follow-up

The existing global acceptance of `Origin: null` while CORS credentials remain
enabled is outside this migration and has not been changed. Before SkinRush
introduces or relies on cookie-authenticated private Steam, user, account, or
inventory routes, review CORS per route and data sensitivity. In particular,
decide whether opaque origins should remain accepted at all and keep the public
catalogue policy separate from future private-data trust decisions.
