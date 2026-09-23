---
'nestjs-rest-query': minor
---

feat(v3)!: cap `paginate=false` and let endpoints forbid it (consumer report #6)

`?paginate=false` used to return every matching row (`ORDER BY` without `LIMIT`), ignoring `maxPerPage`, and no endpoint could refuse it.

- New `forRoot({ pagination: { maxUnpaginatedRows, allowUnpaginated } })`. `maxUnpaginatedRows` defaults to the effective `maxPerPage` (`100`); `allowUnpaginated` defaults to `true`.
- New `defineQueryRules(..., { pagination: { maxUnpaginatedRows, allowUnpaginated } })`. Each key an endpoint declares replaces the global one for that endpoint.
- Adapters fetch at most `maxUnpaginatedRows + 1` roots. A larger result is `400 PAGINATION_INVALID` with `details: { param: 'paginate', maxRows }` — never a truncated list. A forbidden `paginate=false` is the same `400` before any query runs. With a `many` include the cap counts roots.
- `PlanPagination` gains `maxRows`; a third-party adapter should fetch at most `maxRows + 1` rows when `paginate` is `false` (the service re-checks either way).
- Swagger documents the cap, and omits `paginate` on endpoints that forbid it.

**Behaviour change:** an endpoint that returned more than 100 rows with `paginate=false` now gets a `400`. Raise `maxUnpaginatedRows` globally or on that endpoint. See MIGRATION.md, "2.x → 3.x".
