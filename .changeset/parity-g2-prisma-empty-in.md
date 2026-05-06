---
'nestjs-rest-query': patch
---

fix(prisma): treat filter[*][in]= and filter[*][notIn]= (empty) as a no-op (G2, parity gap)

The Prisma adapter previously rejected empty `in` / `notIn` arrays with
a 400, while TypeORM and Drizzle silently dropped the predicate. Prisma
now matches: an empty `in` / `notIn` is a no-op, returning the same
result set as if the filter had not been provided.
