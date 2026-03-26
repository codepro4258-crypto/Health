# Stroke Prevention App — Phase 6: Security Hardening & Observability

## Objective
Strengthen post-deployment runtime security and operational visibility beyond baseline MVP functionality.

## Implemented Hardening Controls

1. **Security headers on API/static responses**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
   - CSP limiting scripts/styles/connect origins to self

2. **Request tracing**
   - `X-Request-Id` generated per request for diagnostics/correlation.

3. **API rate limiting**
   - In-memory per-IP rate limiting for `/api/*` and `/guardian/stream`.
   - Returns `429` with retry metadata when limits are exceeded.

4. **Operational metrics endpoint**
   - `GET /metrics` (admin-only) returns request, API, alert, and rate-limit counters.

## Test Coverage Added
- Security-header presence validation.
- Rate-limiting behavior validation.
- Metrics endpoint authorization and payload validation.

## Commands
```bash
node --check server.js
npm test
```

## Exit Criteria Status
- [x] Security headers enforced.
- [x] Request-level trace ID added.
- [x] Rate limiting active for API paths.
- [x] Admin metrics endpoint implemented.
- [x] Automated tests updated for all new controls.
