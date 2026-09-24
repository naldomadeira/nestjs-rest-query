---
'nestjs-rest-query': patch
---

fix(typeorm): two-phase pagination no longer returns an empty page when the primary key has its own column name

With a `many` relation in the projection, pagination runs in two phases: the first selects the page's root keys, the second hydrates them. The first phase read each key from the raw row by its **property** name (`root_userId`), but TypeORM names raw columns after the **physical** column (`root_user_id`). With `@PrimaryGeneratedColumn({ name: 'user_id' }) userId`, or a naming strategy that renames the PK, every key was `undefined` and the response was `200` with the right `total` and an empty `data`.

Each key part is now selected under an explicit alias, so the lookup no longer depends on how the column is named. Composite keys keep working.
