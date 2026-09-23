---
'nestjs-rest-query': patch
---

fix(v3): bind `decimal` and `date` filter values as text across bundles (consumer report #1)

Every public subpath is its own bundle, so `nestjs-rest-query` and `nestjs-rest-query/typeorm` (and `/prisma`, `/drizzle`) each carried their own copy of `DecimalValue`, `CivilDate` and `RestQueryError`. The plan is built by the root bundle and compiled by the adapter bundle, so the adapter's `instanceof` never matched: the value object reached the driver, and `pg` serialised it with `JSON.stringify` — `filter[price][eq]=29.90` was a `500` (`invalid input syntax for type numeric: ""29.90""`) on TypeORM + PostgreSQL. `date` filters broke the same way in all three adapters, and `400`s thrown by an adapter (e.g. `CAPABILITY_UNAVAILABLE`) surfaced as raw `500`s.

The three classes now carry a `Symbol.for` brand and a static `Symbol.hasInstance`, so identity holds across bundles and across the CJS/ESM builds. No consumer change required.
