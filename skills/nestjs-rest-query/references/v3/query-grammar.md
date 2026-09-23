# 3.x query grammar

## Parameters (exactly these eight)

| Param      | Form                            | Notes                                                                             |
| ---------- | ------------------------------- | --------------------------------------------------------------------------------- |
| `filter`   | `filter[path][op]=value`        | `filter[path]=v` is `eq`; lists as repeated params or quoted CSV                  |
| `sort`     | `sort=name,-price`              | `sorts` (2.x) is an unknown param → 400; conflicting directions → `SORT_CONFLICT` |
| `fields`   | `fields=id,name,brand.name`     | relation fields need the relation in `includes` on the request                    |
| `includes` | `includes=brand`                |                                                                                   |
| `search`   | `search=cabo`                   | substring, OR across `rules.search`, on folded columns                            |
| `page`     | positive decimal integer        | `?page=` (empty) is a 400                                                         |
| `perPage`  | positive integer ≤ `maxPerPage` | above → 400, never clamped                                                        |
| `paginate` | `true`/`false`/`1`/`0`          | `false` → `{ data }` only, capped (below)                                         |

## Operators and coercion

`eq ne gt gte lt lte in notIn between like notLike ilike notIlike isNull`, each
allowed per field in the rules and checked against the field kind.

- Values are coerced by the declared `kind`: `integer` rejects `4.2`/`10abc`,
  `decimal` stays an exact string (`12345678901234567890.123456` survives),
  `date` is a civil `YYYY-MM-DD`, `datetime` needs an offset or `Z`, `boolean`
  takes `true/false/1/0`. Bad input → `400 FILTER_VALUE_INVALID`.
- `%`, `_` and `\` are **literals** in `like`/`ilike`; there are no wildcards.
- `in=[]` matches nothing; `notIn=[]` matches everything; `null` is only
  queryable through `isNull`.
- `between=a,b` is inclusive.

## Pagination

Paginated response: `{ data, page, perPage, total, lastPage }` (`lastPage ≥ 1`,
`total` counts roots). The primary key is always appended as tie-break.

`paginate=false` returns `{ data }`, **capped**: at most `maxUnpaginatedRows`
rows (default the effective `maxPerPage`). The adapter fetches one row past the
cap; a larger result is `400 PAGINATION_INVALID` with
`details: { param: 'paginate', maxRows }` — never a silently truncated list.
`allowUnpaginated: false` (global or per endpoint) refuses the param outright.
On `3.0.0-alpha.0` there is no cap at all (whole table).

## Errors

```jsonc
{
  "statusCode": 400,
  "code": "FIELD_NOT_ALLOWED",
  "message": "filter path is not allowed: secret",
  "details": { "path": "secret", "scope": "filter" },
}
```

Branch on `code`, never on `message`; `details` never echoes the client value.

| Code                           | Status | Typical cause                                                                               |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------- |
| `QUERY_SYNTAX_UNKNOWN_PARAM`   | 400    | a key outside the eight (`utm_source`, `_`, `sorts`, `lang`)                                |
| `QUERY_SYNTAX_INVALID`         | 400    | malformed filter, unsafe path characters, wildcard from client                              |
| `FIELD_NOT_ALLOWED`            | 400    | path not in the rules (also for paths that do not exist)                                    |
| `OPERATOR_NOT_ALLOWED`         | 400    | operator not declared for that field                                                        |
| `FILTER_VALUE_INVALID`         | 400    | value does not match the field kind                                                         |
| `PAGINATION_INVALID`           | 400    | bad `page`/`perPage`/`paginate`, above `maxPerPage`, forbidden or over-cap `paginate=false` |
| `SORT_CONFLICT`                | 400    | same path sorted both ways                                                                  |
| `CAPABILITY_UNAVAILABLE`       | 400    | adapter cannot honour it (Prisma pattern ops on SQLite/SQL Server)                          |
| `SOURCE_CONFIGURATION_INVALID` | 500    | schema ≠ source (kind, nullable, PK, relation), bad `forRoot`/rules                         |
| `ADAPTER_CONTRACT_VIOLATION`   | 500    | unsupported shape (e.g. Drizzle nested collection)                                          |
