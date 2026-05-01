---
'nestjs-rest-query': patch
---

`DrizzleAdapter` now returns rows in the **flat TypeORM-compatible shape**: root columns at the top level, relations as keys at the same level (object for `cardinality: 'one'`, array for `cardinality: 'many'`).

Same SQL, same totals, same two-phase pagination — only the response layout changes from the previous table-grouped form (`{ user: {...}, company: {...} }`) to the flat form (`{ id, name, ..., company: {...}, posts: [...] }`).

`rules.alias` no longer affects the response shape (it remains useful for logging and error messages).

If a root column has the same name as a relation key, the relation overwrites the column. Avoid at schema design time.
