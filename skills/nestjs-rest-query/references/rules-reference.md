# RulesConfig & Whitelist Reference

## Interface

```typescript
interface RulesConfig {
  filters?: string[];    // Fields allowed in filter[field][op]=value
  sorts?: string[];      // Fields allowed in sort parameter
  fields?: string[];     // Columns to SELECT (also restricts sort fields)
  includes?: string[];   // Relations allowed in includes parameter
  search?: string[];     // Optional text search fields for ?search=
  alias?: string;        // QueryBuilder alias (default: 'root')
}
```

## Security Model

The whitelist is **deny by default**. Any field not explicitly listed causes a **400 Bad Request**.

Fields are NEVER silently ignored — this is intentional to prevent clients from assuming a filter is active when it is not.

**Field naming rule:** use TypeORM entity property names, not raw database column names. In most projects this means `camelCase` (`createdAt`, `firstName`, `overallStatus`). Only use `snake_case` when the entity property itself is declared that way.

## Rules

### filters

Declares which fields can be used in `filter[field][operator]=value`.

```typescript
@ApiDynamicQuery({
  filters: ['name', 'email', 'status', 'createdAt'],
})
```

- Only listed fields are accepted
- Unlisted field → 400 Bad Request
- Supports dot notation for relations: `'user.firstName'`
- Dot-notation fields require the parent relation in `includes`

### sorts

Declares which fields can be used in `sort=field,-field`.

```typescript
@ApiDynamicQuery({
  sorts: ['name', 'createdAt'],
})
```

- `sort=name` → ASC
- `sort=-name` → DESC
- `sort=-createdAt,name` → ORDER BY createdAt DESC, name ASC

### fields

Declares which columns are SELECTed. Also restricts sort fields.

```typescript
@ApiDynamicQuery({
  fields: ['id', 'name', 'email'],
  sorts: ['name'],  // 'name' MUST be in fields
})
```

**Critical:** When `fields` is defined, ALL sort fields MUST also be in `fields`. A sort field not in `fields` causes a TypeORM error because the column was not selected.

**If `fields` is not set:** All entity columns are selected (SELECT *).

### includes

Declares which relations can be loaded via `includes=relation1,relation2`.

```typescript
@ApiDynamicQuery({
  includes: ['company', 'roles', 'roles.permissions'],
})
```

- Relations are loaded via `leftJoinAndSelect`
- Nested relations use dot notation: `'items.company'`
- Relations are NOT loaded unless the client requests them via `includes=`
- Do NOT use TypeORM `eager: true` on entities — use `includes` instead

### search

Optional native text search introduced in `4.0.0`.

```typescript
@ApiDynamicQuery({
  search: ['name', 'email', 'company.name'],
})
```

- Use only when the endpoint needs a quick text search box
- Client sends `?search=john`
- Fields are combined with `OR`
- Supports nested fields such as `'company.name'` and `'items.company.cnpj'`
- Search is based on entity/repository field paths, not raw database column names
- Not every endpoint needs `search` — omit it when not useful

### alias

Custom alias for the query builder root entity. Default: `'root'`.

```typescript
@ApiDynamicQuery({
  alias: 'u',
  filters: ['name'],
})
```

Useful when you need to reference the alias in `customize` callbacks.

## Common Patterns

### Simple CRUD endpoint

```typescript
@ApiDynamicQuery({
  filters: ['name', 'email', 'status'],
  sorts: ['name', 'createdAt'],
})
```

### Endpoint with field selection

```typescript
@ApiDynamicQuery({
  filters: ['name', 'status'],
  sorts: ['name'],
  fields: ['id', 'name', 'status'],
})
```

### Endpoint with relationships

```typescript
@ApiDynamicQuery({
  filters: ['overallStatus', 'user.firstName', 'user.email'],
  sorts: ['createdAt'],
  fields: ['id', 'overallStatus', 'createdAt'],
  includes: ['user', 'items', 'items.company', 'items.module'],
  search: ['user.firstName', 'items.company.name'],
})
```

### Minimal endpoint (no whitelist restrictions)

```typescript
@ApiDynamicQuery({})
// Warning: No filters, sorts, or includes allowed.
// Only pagination works (page, perPage, paginate).
```

## Security Recommendations

1. **Never whitelist sensitive fields** — `password`, `token`, `secret`, `hash` must never appear in `filters` or `fields`
2. **Minimize whitelist** — only expose fields the client actually needs
3. **Audit regularly** — review whitelists when entity schemas change
4. **Use customize for server-side logic** — tenant filtering, soft deletes, and access control should use the `customize` callback, not client-facing filters
