---
'nestjs-rest-query': patch
---

fix(drizzle): a `search` target through a nullable `one` relation no longer drops roots without that relation

`search` is an OR across its targets. With `search: ['name', 'company.name']`, the Drizzle adapter joined `company` with an `INNER JOIN`, so a user without a company disappeared from `data` and from `total` even when its own `name` matched. TypeORM and Prisma kept that user.

Search targets on `one` relations now join with `LEFT JOIN`, in the data statement and in the count. A relation that is also a filter (an AND term) still joins with `INNER JOIN`.
