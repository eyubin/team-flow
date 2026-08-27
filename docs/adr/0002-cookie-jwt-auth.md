# ADR 0002: Cookie-based JWT authentication

- Status: Accepted
- Date: 2026-08-27

## Context

The SPA must authenticate against the Spring API. The plan requires a short-lived credential, HttpOnly/Secure/SameSite cookies if cookies are used, CSRF protection for cookie auth, CORS allowlist, and a written rationale. A custom OAuth server is out of scope.

Attack goals we care about:

- XSS should not be able to read the session token from JavaScript.
- CSRF should not be able to mutate data using the browser’s cookies alone.
- Stolen access tokens should expire quickly.

## Decision

Use **stateless JWTs delivered as cookies**, not `localStorage` and not a server-side session table for MVP.

| Cookie           | Lifetime (order of magnitude) | Purpose                         |
| ---------------- | ----------------------------- | ------------------------------- |
| `access_token`   | ~15 minutes                   | Bearer identity for `/api/*`    |
| `refresh_token`  | ~7 days                       | Rotate access token             |
| `XSRF-TOKEN`     | Session / aligned with access | Double-submit CSRF (readable)   |

Cookie flags:

- `HttpOnly` on access and refresh (not on the CSRF cookie — the SPA must copy it to a header).
- `Secure` in production (`SameSite` does not replace HTTPS).
- `SameSite=Lax` (adequate for top-level navigations; API is same-site behind Compose or a single origin in prod).
- `Path=/`; refresh cookie may use a narrower path (`/api/auth/refresh`) if implemented.

CSRF: **double-submit cookie**. Mutating methods (`POST`, `PATCH`, `PUT`, `DELETE`) require header `X-XSRF-TOKEN` equal to the CSRF cookie. Spring Security CSRF with CookieCsrfTokenRepository is the intended implementation.

CORS: explicit allowlist of the SPA origin; `allowCredentials=true`. No `*`.

Tokens:

- Access JWT claims: `sub` (user id), `email`, `iat`, `exp`. Roles are **not** the source of truth in the token for resource authz; workspace role is loaded from `workspace_members`.
- Refresh JWT is a separate secret/purpose (`typ=refresh`) or a random opaque token hashed in DB. **Default for Stage 1–2:** signed refresh JWT (no extra table). Revisit if logout-all-devices is required.
- Algorithm: `HS256` with secrets from environment (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`), never committed.
- Password hashing: **Argon2**.

Logout: clear cookies (`Max-Age=0`). Stateless JWT cannot be revoked until expiry unless we add a denylist; MVP accepts that access tokens live up to 15 minutes after logout. Document this trade-off in README.

## Consequences

Positive:

- XSS cannot `document.cookie` the access token.
- Demonstrates CSRF, cookie flags, and CORS credentials — common interview topics.
- API stays horizontally scalable (no sticky sessions).

Negative:

- Cross-site cookie + SPA on another origin needs careful CORS and CSRF; local Vite proxy or same-site Compose URLs reduce pain.
- Logout is not instant for the access JWT.
- Mobile native clients are awkward (out of scope).

## Alternatives considered

- **Bearer JWT in `Authorization` header (memory only):** no CSRF, but XSS in the SPA can read the token if it is ever put in JS-accessible storage; also easier to leak via logs/extensions. Rejected for this portfolio’s security narrative.
- **Servlet session / Spring Session in Redis:** stronger logout/revocation; extra infrastructure for MVP.
- **OAuth2/OIDC (Keycloak, Auth0):** excellent for real products; out of scope and hides the auth code we want to show.
