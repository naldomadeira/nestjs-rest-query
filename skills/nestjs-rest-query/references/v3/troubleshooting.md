# 3.x troubleshooting

Start from the installed version (Step 1 of `SKILL.md`): a defect listed below
for that version explains the symptom before any consumer code does.

## Known defects by version

| Symptom                                                                                                                                                | `3.0.0-alpha.0` | Later alphas   | Action on alpha.0                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | -------------- | ------------------------------------------------------------------------ |
| `decimal` filter → 500 `invalid input syntax for type numeric: ""29.90""`; `date` filters fail on every adapter; an adapter 400 shows up as a bare 500 | defect          | fixed          | upgrade                                                                  |
| TypeORM filter/`search` through a `many` relation → 500 `column dqb_ex_….isaccessory does not exist` or `relation "…" does not exist`                  | defect          | fixed          | upgrade; until then keep property = column name and the default schema   |
| Swagger UI "Try it out" fails for every route with `ReferenceError: interceptSwaggerRequest is not defined`                                            | defect          | fixed          | upgrade; or a self-contained local `requestInterceptor`                  |
| `paginate=false` returns the whole table                                                                                                               | defect (no cap) | capped         | upgrade; `maxUnpaginatedRows`/`allowUnpaginated` do not exist on alpha.0 |
| Filters/sort/page silently ignored, 200 with the default page, under `ValidationPipe({ whitelist: true })`                                             | defect          | **still open** | take the query via a custom param decorator (`references/v3/setup.md`)   |
| `forRoot({ portability: { enforce: true } })` has no effect                                                                                            | defect          | still open     | call `assertProfileFacts`/`checkPortabilityProfile` yourself at boot     |

## By error

- **`QUERY_SYNTAX_UNKNOWN_PARAM`** — a key outside the grammar reached
  `execute()`: tracking params, cache busters, 2.x `sorts`, your endpoint's own
  params. Destructure them out first (`const { ofSku, ...query } = raw`).
- **`FIELD_NOT_ALLOWED`** — path not in the rules, and paths are exact:
  `company.name` needs its own entry; `fields=brand.name` also needs
  `includes=brand` on the request.
- **`PAGINATION_INVALID` on `paginate=false`** — the result exceeds
  `maxUnpaginatedRows` (default `maxPerPage`) or the endpoint forbids it. Raise
  the cap on that endpoint's rules (`pagination: { maxUnpaginatedRows }`) or
  paginate.
- **500 `SOURCE_CONFIGURATION_INVALID` on the first request** — the declared
  schema disagrees with the source (`details` names path and property: kind,
  nullable, primaryKey, foldedField, relation nullable). Fix the schema to match
  the entity/table. On a `uuid` primary key without `portableOrderField`, every
  listing fails: add the order column.
- **Boot fails in `defineQueryRules`** — e.g.
  `Search field X declares no folded field`, a sort through `many`, a default outside allowed. The message
  names the path.
- **Boot fails in `forRoot`** — `adapter`/`operators` keys (2.x), a
  `textProfile` other than `portable-strict`, `consistency: 'transactional'`,
  invalid pagination numbers.
- **Filters arrive as strings / ignored** — missing
  `app.set('query parser', 'extended')`.
- **`ilike` misses accented text** — folding is NFC + lower case only; no
  accent stripping by design.
- **Text sort order differs from expectations** — ordering follows the column
  collation; the portable profile expects binary/`C` collation.
