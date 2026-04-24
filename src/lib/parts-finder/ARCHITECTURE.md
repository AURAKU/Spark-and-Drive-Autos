# Parts Finder Architecture

This module restores the service-layer boundaries for Spark & Drive Parts Finder.

## Core flow

1. `input-normalizer.ts` parses user input.
2. `query-builder.ts` builds searchable query strings.
3. `external-search.ts` fetches candidate evidence.
4. `result-parser.ts` cleans and deduplicates candidates.
5. `ranking.ts` scores and labels candidates.
6. `safety-rules.ts` enforces confidence safeguards.
7. `persistence.ts` records search telemetry.
8. `conversion.ts` records conversion actions.

## Access boundaries

- `access.ts` provides user/admin guards.
- API routes under `src/app/api/parts-finder` call these services.
- Admin and dashboard pages use audit/payment-backed snapshots when advanced tables are unavailable.
