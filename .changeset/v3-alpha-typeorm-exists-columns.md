---
'nestjs-rest-query': patch
---

fix(typeorm): use physical, quoted, schema-qualified identifiers inside `EXISTS` (consumer report #2)

A filter or `search` through a `many` relation compiles to a correlated `EXISTS`, which TypeORM treats as raw SQL. That subquery used the **property** name for the leaf column (`dqb_ex_products.isAccessory` for `@Column({ name: 'is_accessory' })`), left identifiers unquoted (PostgreSQL folded them to lower case) and dropped the table's schema. Any snake_case naming strategy, `@Column({ name })` or non-default schema was a `500`.

The column now comes from the target entity's metadata, the table from its `tablePath` (schema included), and every identifier — table, alias and column — is quoted by the driver.
