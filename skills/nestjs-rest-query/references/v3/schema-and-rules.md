# 3.x schema and rules

## Schema — what the model is

`defineQuerySchema({ model, primaryKey, fields, relations })`. Every field:

| Key                      | Meaning                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`                   | the **property** name (TypeORM entity property, Prisma field, Drizzle column key) — never the SQL column                                        |
| `kind`                   | `string`, `uuid`, `enum` (+ `enumValues`), `integer`, `bigint`, `decimal`, `boolean`, `date`, `datetime`, `json`, `binary`                      |
| `nullable`, `primaryKey` | must match the source; checked on the first `execute()` (500 `SOURCE_CONFIGURATION_INVALID`)                                                    |
| `foldedField`            | companion column holding `foldText(value)` (NFC + lower case); **required** for `ilike`, `notIlike` and `search` on this field                  |
| `portableOrderField`     | companion text column with a total order identical across databases; **required** on a `uuid` primary key (the PK is always the sort tie-break) |
| `internal: true`         | the companion columns themselves: queryable internally, never exposed                                                                           |

Relations: `{ path, target, cardinality: 'one' | 'many', nullable }`. A
`many-to-one` with a `NOT NULL` FK is `nullable: false`; `one-to-many` is
`nullable: true`. The registry passed to `defineQueryRules` must contain every
model reachable from the root.

TypeORM can derive it: `buildSchemaRegistry(repository, { fieldKinds })` from
`nestjs-rest-query/typeorm` (companions found by the `<property>_folded` /
`<property>_order` naming convention). Drizzle: `buildSourceSchema(table, relations)`.
Prisma: hand-written (no generator yet).

Companion columns are schema migrations **you** write: the folded column plus a
listener/trigger keeping it in sync (`foldText` is exported), and the order
column (a generated `id::text COLLATE "C"` works on PostgreSQL). No accent
stripping: `ilike 'atomo'` does not match `Átomo`.

## Rules — what an endpoint authorises

```typescript
defineQueryRules(registry, 'product', {
  filters: [{ path: 'price', operators: ['gte', 'lte', 'between'] }], // per field, exact path
  sorts: ['name', 'brand.name'], // never through a `many` relation
  fields: {
    root: { allowed: ['id', 'name'], default: ['id', 'name'] }, // mandatory
    relations: { brand: { allowed: ['id', 'name'], default: ['id'] } }, // `brand.*` allowed here
  },
  includes: ['brand'], // needed to project brand fields
  search: ['name', 'brand.name'], // each target needs a foldedField
  pagination: { maxUnpaginatedRows: 500 }, // optional, see below
});
```

- Validated at construction: unknown paths, operators incompatible with the
  kind, `default ⊄ allowed`, `search` without folded column, sort through
  `many` — all fail at **boot**, not per request.
- Exact paths: `company` authorises the relation (e.g. `isNull`), not
  `company.name`. Filter/search through a `many` relation is existential
  ("some item matches") and never inflates `total`.
- Rules are data: compile them once at module scope and pass the same object
  to `@ApiDynamicQuery(rules)`; `@QueryRules()` reads it back in the handler.

### `pagination` (per endpoint)

| Key                  | Effect                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `allowUnpaginated`   | `false` → `?paginate=false` is `400 PAGINATION_INVALID`, no query runs, and Swagger drops the `paginate` param |
| `maxUnpaginatedRows` | row cap for `paginate=false` on this endpoint                                                                  |

Each declared key **replaces** the `forRoot` value for this endpoint; omitted
keys inherit it. Use a higher cap for "all brands" dropdowns and
`allowUnpaginated: false` on large tables. Available after `3.0.0-alpha.0`.
