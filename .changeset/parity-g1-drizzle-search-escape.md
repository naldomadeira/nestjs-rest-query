---
'nestjs-rest-query': patch
---

fix(drizzle): escape % and _ in search terms (G1, parity gap)

The Drizzle adapter previously interpolated the user's search term into
the ILIKE pattern without escaping `%` or `_`, so `?search=50%25` would
match more rows than the literal string `50%`. The TypeORM handler has
always escaped these characters, and the Prisma adapter is unaffected
because it uses Prisma's literal `contains` operator. Drizzle now
matches both: the term is escaped before being wrapped with `%...%`.
