# SkinRush Engineering Constraints

These constraints apply to all future implementation work in this repository.

## 1. Security is a top-level requirement

Treat security as a first-class requirement alongside correctness and performance.

SkinRush deals with CS2 skins and may eventually handle:

- Steam identities
- Steam authentication
- public/private profile information
- inventory information
- saved skins/loadouts
- user preferences
- potentially valuable skin ownership information
- market/API integrations

Assume that attackers may deliberately inspect browser network traffic, frontend JavaScript, custom-element events, Wix/Velo code, API routes, query parameters, API responses, error messages, browser storage, cookies, session handling, logs, and undocumented endpoints to find information that could help identify, profile, impersonate, or target SkinRush users.

Do not rely on the frontend hiding something as a security control. Anything delivered to the browser must be considered visible to the visitor.

## 2. Data minimisation

Every API response and bridge payload must contain only the data required for the current UI or function.

Before adding a field to `/api/skins`, another API route, `skinrush-results-change`, `skinrush-command`, Wix Page Code, browser storage, or logs, ask:

> Does the browser actually need this value?

If not, do not send it.

Do not expose entire database rows for convenience. Explicitly map public response objects to approved public fields. Never use patterns equivalent to `SELECT *` for public API responses where a smaller explicit projection is possible.

## 3. User-specific data

If a future route exposes user-specific information, never trust a user ID, Steam ID, profile ID, or member ID supplied by the browser as proof of identity or ownership.

Authorisation must be performed server-side using the authenticated session. A request must not be allowed to retrieve another user's private information merely by changing `?userId=...` or `/api/users/<id>/inventory`.

The backend must independently determine whether the authenticated user is authorised to access the requested resource. Prevent IDOR/BOLA-style access issues throughout the API.

## 4. Steam and authentication data

Never expose any of the following through frontend code, custom-element attributes, Wix Page Code, API responses, or logs:

- Steam authentication secrets
- session secrets
- API keys
- signing secrets
- OAuth/OpenID secrets where applicable
- refresh/access tokens that do not explicitly belong in the browser
- database credentials
- Render environment secrets
- Wix secrets
- CSFloat/private marketplace credentials

Secrets belong server-side in the appropriate environment or secret storage. Never commit secrets into Git.

## 5. Inventory privacy

Do not assume CS2 inventory information is harmless simply because some Steam inventory information may be publicly obtainable elsewhere. SkinRush should not unnecessarily aggregate or expose information that makes targeting users easier.

For any future inventory feature, explicitly assess:

- whether inventory visibility should be private by default
- whether exact ownership needs to be exposed publicly
- whether Steam IDs need to be returned
- whether inventory value needs to be public
- whether expensive/rare holdings need to be enumerable
- whether another user's complete inventory can be queried through the API

Do not create bulk user-inventory enumeration endpoints without an explicit product and security review.

## 6. API route security

For every new or modified route, explicitly assess:

- authentication requirement
- authorisation requirement
- input validation
- output/data minimisation
- SQL injection
- IDOR/BOLA
- rate limiting/abuse potential
- enumeration risk
- error information leakage
- CORS exposure
- CSRF where relevant
- caching of private responses
- logging of sensitive values

Use parameterised queries. Never concatenate raw request values into SQL. Continue using fixed allowlists for things such as sorting and field selection.

## 7. Public skin database versus private user data

Keep a strong architectural separation between public catalogue data—such as skin name, weapon, rarity, float range, case, and collection—and user/private data—such as authenticated Steam identity, inventory ownership, saved private loadouts, account information, member data, and private preferences.

Do not make private-user information available simply because it is convenient to combine it with public skin catalogue data.

## 8. Browser and Wix bridge

Treat the Wix/custom-element bridge as an untrusted client boundary.

DOM events, custom-event payloads, attributes, query parameters, repeater interactions, and browser state are not trusted merely because they originated from Wix or the custom element.

Validate commands before acting on them. The `skinrush-command` attribute must remain a narrow allowlisted command protocol. Do not turn it into a generic method invocation system.

Only explicitly supported commands should be accepted. Unknown commands and malformed payloads must fail safely. Do not include sensitive user information in `skinrush-results-change`.

## 9. Error handling

Public errors should be useful but non-sensitive.

Do not expose:

- stack traces
- SQL
- table names unnecessarily
- filesystem paths
- environment variables
- credentials
- internal service URLs
- raw third-party API responses containing sensitive information

Log enough server-side information to diagnose problems without leaking secrets into visitor-visible responses.

## 10. Dependencies

Minimise third-party dependencies.

Before introducing a package, determine whether existing project code already solves the problem, the browser or platform already provides the required capability, or a small internal helper would be safer and simpler.

Do not install a large package for a trivial function.

When a dependency is justified:

- use an actively maintained package
- use the minimum package required
- avoid importing an entire library when only a small module or icon is needed
- keep package versions under normal dependency management
- do not suppress security warnings merely to make a build green

## 11. Minimise code bloat

Prefer the smallest maintainable implementation that satisfies the approved requirement.

Do not:

- duplicate filtering logic
- duplicate API clients
- create parallel state systems
- duplicate business rules between Wix and the custom element
- introduce abstractions without a real reuse requirement
- create helper layers simply to make the architecture look sophisticated
- retain obsolete implementations indefinitely after a migration is verified

Reuse existing functions and state pipelines wherever practical.

For the native Wix repeater migration specifically:

- the custom element remains the application/state controller
- Wix Page Code remains a thin rendering adapter
- no second `/api/skins` request should be introduced
- no second filter engine should exist
- no second sorting engine should exist

Once the native repeater is fully verified and the old CSS result renderer is genuinely no longer required, propose its safe removal rather than permanently maintaining two implementations. Do not remove it until the migration passes QA.

## 12. Performance and payload size

Avoid sending or processing data the UI does not need.

Prefer bounded pagination, explicit fields, server-side filtering, server-side sorting, and server-side authorisation over downloading large datasets and processing them in the browser.

Avoid N+1 queries. Do not trade security for frontend convenience.

## 13. Security review before completion

Before declaring any meaningful implementation task complete, include a short security assessment covering:

1. What new attack surface was introduced?
2. What user-controlled input was added?
3. What data is now exposed to the browser?
4. Does any route require authentication?
5. Does any route require authorisation beyond authentication?
6. Could IDs or parameters be changed to access someone else's data?
7. Are SQL/database operations fully parameterised?
8. Could responses expose unnecessary sensitive information?
9. Are secrets present anywhere client-side?
10. Are error messages safe?
11. Was unnecessary code or dependency duplication introduced?
12. Are there obvious abuse, enumeration, or rate-limit concerns?

If a security concern cannot be confidently resolved within the approved scope, stop and report it before proceeding.

## 14. Never weaken security silently

Do not:

- disable validation to make something work
- broaden CORS without justification
- expose a secret to solve a frontend problem
- remove authentication checks to simplify testing
- bypass authorisation
- trust client-supplied ownership information
- suppress a legitimate security failure
- expose additional user data as a temporary workaround

If the secure implementation conflicts with the requested architecture, report the conflict and propose the smallest secure alternative.

## 15. Completion reporting

For future implementation reports, include:

- code added
- code removed
- dependencies added
- dependencies removed
- duplicated or obsolete code identified
- public API fields added or removed
- client-visible data added or removed
- security considerations reviewed
- unresolved security risks
- whether authentication or authorisation behaviour changed

Optimise for:

> Minimum necessary code + minimum necessary data exposure + explicit server-side trust boundaries.

Security takes priority over implementation convenience.
