# Advanced Patterns

## Customize Callback — The Escape Hatch

The `customize` callback is the most powerful feature of the library. It gives you full access to the TypeORM `SelectQueryBuilder` **after** all filters, includes, fields, and sorts have been applied by the library. Use it for any server-side logic that should NOT be exposed as a client-facing query parameter.

```typescript
async execute<T>(
  repository: Repository<T>,
  query: QueryInput,
  rules: RulesConfig,
  customize?: (qb: SelectQueryBuilder<T>) => void
): Promise<QueryResult<T>>
```

### Execution Order

Understanding when `customize` runs is critical:

```
1. buildQuery() creates SelectQueryBuilder with alias 'root'
2. applyFilters()   → WHERE clauses from client filter[field][op]=value
3. applyIncludes()  → leftJoinAndSelect for client includes=relation
4. applySearch()    → WHERE clauses from client search=term (if RulesConfig.search exists)
5. applyFields()    → SELECT specific columns
6. applySorts()     → ORDER BY from client sort=field
7. customize(qb)    → YOUR CODE RUNS HERE ← full access to qb
8. applyPagination() → LIMIT/OFFSET (only if paginate=true)
```

This means inside `customize` you can:
- Read/modify all joins the library already created
- Add WHERE clauses that stack with library filters (AND)
- Add your own joins for relations NOT in the includes whitelist
- Add ORDER BY, GROUP BY, HAVING, subqueries
- Override or extend anything the library set up

**Naming rule:** in `RulesConfig` and public query params, use entity property names (usually `camelCase`). Inside `customize`, when writing manual SQL strings, using physical database column names in `snake_case` is fine.

---

### Pattern 1: Soft Delete Filtering

Exclude soft-deleted records without exposing `deleted_at` to the client.

```typescript
async findAll(query: QueryInput, rules: RulesConfig) {
  return this.queryBuilderService.execute(
    this.usersRepo,
    query,
    rules,
    (qb) => {
      // Manual SQL in customize can use the physical DB column name.
      qb.andWhere('root.deleted_at IS NULL');
    },
  );
}
```

The client cannot bypass this — it runs server-side regardless of query parameters.

---

### Pattern 2: Multi-Tenant Isolation

Force tenant scoping on every query.

```typescript
async findAll(query: QueryInput, rules: RulesConfig, tenantId: string) {
  return this.queryBuilderService.execute(
    this.ordersRepo,
    query,
    rules,
    (qb) => {
      // Manual SQL in customize can use the physical DB column name.
      qb.andWhere('root.tenant_id = :tenantId', { tenantId });
    },
  );
}
```

---

### Pattern 3: Native Text Search

Since `4.0.0`, the library has built-in optional `search`. Use it when the endpoint needs a simple text search box:

```typescript
@Get()
@ApiDynamicQuery({
  filters: ['name', 'email', 'status'],
  sorts: ['name'],
  search: ['name', 'email'],
})
async findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: RulesConfig,
) {
  return this.queryBuilderService.execute(this.usersRepo, query, rules);
}
```

Usage: `GET /users?search=john&filter[status][eq]=active`

Search and filters work together — search adds an AND clause alongside any client filters.

---

### Pattern 4: Native Text Search Across Relations

Native `search` also supports nested fields. The library reuses joins created by `includes` and creates `leftJoin` automatically when needed.

```typescript
@Get()
@ApiDynamicQuery({
  filters: ['overallStatus'],
  sorts: ['createdAt'],
  includes: ['user', 'items', 'items.company'],
  search: ['overallStatus', 'user.firstName', 'user.email', 'items.company.name'],
})
async findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: RulesConfig,
) {
  return this.queryBuilderService.execute(this.accessRequestsRepo, query, rules);
}
```

Usage: `GET /access-requests?search=naldo`

**Important notes:**
- `search` is optional — only configure it for endpoints that need it
- Use entity property names in `camelCase` when your entities follow that pattern
- Nested fields use dot notation such as `user.firstName` and `items.company.name`
- If the relation is already in `includes`, the join is reused automatically

---

### Pattern 5: Row-Level Access Control

Restrict query results based on the authenticated user's permissions.

```typescript
async findAll(query: QueryInput, rules: RulesConfig, currentUser: User) {
  return this.queryBuilderService.execute(
    this.documentsRepo,
    query,
    rules,
    (qb) => {
      if (currentUser.role !== 'admin') {
        // Non-admins only see their own documents
        qb.andWhere('root.owner_id = :userId', { userId: currentUser.id });
      }
      // Admins see everything — no extra WHERE
    },
  );
}
```

---

### Pattern 6: Date Range Defaults

Force a default date range when the client does not send date filters.

```typescript
(qb) => {
  // Public query params use entity property names, so check createdAt here.
  if (!query.filter?.createdAt) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    // Manual SQL can still reference the physical DB column name.
    qb.andWhere('root.created_at >= :since', { since: thirtyDaysAgo });
  }
}
```

---

### Pattern 7: Aggregations and Subqueries

Add computed columns or subquery conditions.

```typescript
(qb) => {
  // Add a computed column
  qb.addSelect('root.price * root.quantity', 'line_total');

  // Subquery: only orders with at least 3 items
  qb.andWhere((subQb) => {
    const sub = subQb
      .subQuery()
      .select('COUNT(*)')
      .from('order_items', 'oi')
      .where('oi.order_id = root.id')
      .getQuery();
    return `(${sub}) >= 3`;
  });
}
```

---

### Pattern 8: Combining Native Search With Customize

You can stack multiple patterns in a single callback.

```typescript
async findAll(
  query: DynamicQueryDto,
  rules: RulesConfig,
  tenantId: string,
) {
  return this.queryBuilderService.execute(
    this.productsRepo,
    query,
    rules,
    (qb) => {
      // 1. Tenant isolation (always)
      qb.andWhere('root.tenant_id = :tenantId', { tenantId });

      // 2. Soft delete (always)
      qb.andWhere('root.deleted_at IS NULL');
    },
  );
}
```

In this pattern, native `search` is declared in `RulesConfig.search` and `customize` is used only for the server-side constraints.

---

### Limitations of Customize

1. **No async support** — the callback signature is `(qb) => void`, not async. If you need async data (e.g., fetching permissions from another service), resolve it before calling `execute()` and pass the result via closure.

2. **Runs before pagination** — your WHERE clauses affect the total count. This is correct behavior (you want `total` to reflect the filtered dataset).

3. **Cannot override library behavior** — you can add to the query but cannot remove filters/sorts the library already applied. If you need full control, use `buildQuery()` instead.

4. **Join alias conflicts** — if you add joins with the same alias the includes handler uses, TypeORM may error. Use unique aliases for customize joins (e.g., `search_user` instead of `user`).

---

## buildQuery()

Returns a `SelectQueryBuilder` with all filters/sorts/includes/fields applied but NOT executed. Use for full control when `customize` is not enough.

```typescript
async findAll(query: QueryInput, rules: RulesConfig) {
  const qb = this.queryBuilderService.buildQuery(
    this.usersRepo,
    query,
    rules,
  );

  // Full control — add anything
  qb.andWhere('root.is_active = :active', { active: true });
  qb.addSelect('root.internal_score');

  // Execute manually
  const [data, total] = await qb.getManyAndCount();

  return {
    data,
    total,
    page: query.page ?? 1,
    perPage: query.perPage ?? 10,
    lastPage: Math.ceil(total / (query.perPage ?? 10)),
  };
}
```

**When to use `buildQuery()` vs `customize`:**
- `customize` — for adding WHERE, joins, ORDER BY while keeping the library's pagination
- `buildQuery()` — when you need to control execution (custom aggregation, raw queries, manual pagination)

---

## ApiPaginatedResponse Decorator

Generates Swagger response schema for paginated endpoints:

```typescript
@Get()
@ApiDynamicQuery({ filters: ['name'] })
@ApiPaginatedResponse(User)
async findAll(
  @Query() query: DynamicQueryDto,
  @QueryRules() rules: RulesConfig,
) {
  return this.usersService.findAll(query, rules);
}
```

Generates OpenAPI schema with `data` array, `page`, `perPage`, `total`, `lastPage`.
