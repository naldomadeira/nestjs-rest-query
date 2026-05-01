# Filter Operators Reference

## Syntax

```
filter[field][operator]=value
```

All filter values are strings in the URL. The library handles type coercion.

## Operators

### Comparison

| Operator | SQL        | Example                      | Result                      |
| -------- | ---------- | ---------------------------- | --------------------------- |
| `eq`     | `= value`  | `filter[status][eq]=active`  | `WHERE status = 'active'`   |
| `ne`     | `!= value` | `filter[status][ne]=deleted` | `WHERE status != 'deleted'` |
| `gt`     | `> value`  | `filter[age][gt]=18`         | `WHERE age > 18`            |
| `gte`    | `>= value` | `filter[age][gte]=18`        | `WHERE age >= 18`           |
| `lt`     | `< value`  | `filter[price][lt]=100`      | `WHERE price < 100`         |
| `lte`    | `<= value` | `filter[price][lte]=100`     | `WHERE price <= 100`        |

### Text Search

| Operator   | SQL                                  | Example                       | Notes                                 |
| ---------- | ------------------------------------ | ----------------------------- | ------------------------------------- |
| `like`     | `LIKE %value%`                       | `filter[name][like]=John`     | Case-sensitive                        |
| `ilike`    | `LOWER(col) LIKE LOWER(%value%)`     | `filter[name][ilike]=john`    | Case-insensitive, cross-DB compatible |
| `notLike`  | `NOT LIKE %value%`                   | `filter[name][notLike]=test`  | Case-sensitive exclusion              |
| `notIlike` | `LOWER(col) NOT LIKE LOWER(%value%)` | `filter[name][notIlike]=test` | Case-insensitive exclusion            |

**Recommendation:** Always prefer `ilike` over `like` for user-facing search. It uses `LOWER()` for portability across PostgreSQL, MySQL, and SQLite.

**Performance tip:** For PostgreSQL with `ilike`, consider adding a functional index: `CREATE INDEX idx_name_lower ON users (LOWER(name))`.

### Set Operations

| Operator | SQL               | Example                                  | Notes                       |
| -------- | ----------------- | ---------------------------------------- | --------------------------- |
| `in`     | `IN (values)`     | `filter[status][in]=active,pending`      | CSV: comma-separated values |
| `notIn`  | `NOT IN (values)` | `filter[status][notIn]=deleted,archived` | CSV: comma-separated values |

### Range

| Operator  | SQL               | Example                                       | Notes                            |
| --------- | ----------------- | --------------------------------------------- | -------------------------------- |
| `between` | `BETWEEN a AND b` | `filter[date][between]=2024-01-01,2024-12-31` | Exactly 2 comma-separated values |

### Null Check

| Operator | SQL                       | Example                           | Notes                                   |
| -------- | ------------------------- | --------------------------------- | --------------------------------------- |
| `isNull` | `IS NULL` / `IS NOT NULL` | `filter[deleted_at][isNull]=true` | `true` = IS NULL, `false` = IS NOT NULL |

## Combining Filters

Multiple filters are combined with AND:

```
GET /users?filter[status][eq]=active&filter[age][gte]=18&filter[name][ilike]=ana
```

Generates: `WHERE status = 'active' AND age >= 18 AND LOWER(name) LIKE LOWER('%ana%')`

## Filtering on Relations

Use dot notation to filter on related entity fields. The relation MUST be in the `includes` whitelist.

```
GET /orders?filter[user.email][ilike]=john&includes=user
```

RulesConfig:

```typescript
@ApiDynamicQuery({
  filters: ['status', 'user.email'],
  includes: ['user'],
})
```

## Global Operator Restrictions

You can restrict which operators are available globally via `forRoot`:

```typescript
DynamicQueryBuilderModule.forRoot({
  operators: {
    allowed: ['eq', 'ne', 'ilike', 'in'],
  },
});
```

Using a non-allowed operator returns **400 Bad Request**.
