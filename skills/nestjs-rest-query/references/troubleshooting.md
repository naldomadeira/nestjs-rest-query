# Troubleshooting

## Common Errors and Solutions

### filter[field][op] is not parsed / arrives as string

**Cause:** Missing extended query parser in `main.ts`.

**Fix:**
```typescript
app.set('query parser', 'extended');
```

Without this, Express uses the simple query parser which does not expand bracket syntax.

---

### page/perPage always 1/10 or NaN

**Cause:** Missing `enableImplicitConversion` in ValidationPipe.

**Fix:**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

---

### 400 Bad Request — field not allowed

**Cause:** Client is using a field not in the endpoint's whitelist.

**Fix:** Add the field to the appropriate array in `@ApiDynamicQuery`:

```typescript
@ApiDynamicQuery({
  filters: ['name', 'missing_field'], // add here for filters
  sorts: ['missing_field'],           // add here for sorts
})
```

This is intentional security behavior — fields are never silently ignored.

---

### TypeORM error — column not found in sort

**Cause:** Sort field is not in `fields` array. When `fields` is defined, sort fields must also be selected.

**Fix:** Add the sort field to `fields`:

```typescript
@ApiDynamicQuery({
  fields: ['id', 'name', 'createdAt'], // createdAt must be here
  sorts: ['createdAt'],                // because it's here
})
```

Use entity property names from the TypeORM repository/entity class. In most projects this means `camelCase`, not raw database column names.

---

### Relations not loading

**Cause:** Relation not in `includes` whitelist, or client not sending `includes=` parameter.

**Fix:**
1. Add relation to `includes` in decorator:
```typescript
@ApiDynamicQuery({
  includes: ['company', 'roles'],
})
```
2. Client must request: `GET /endpoint?includes=company`

Relations are NOT loaded by default — the client must explicitly request them.

---

### Nested filter not working (e.g., filter[user.name][eq]=x)

**Cause:** Parent relation not in `includes` whitelist.

**Fix:** Add both the nested filter field AND the parent relation:

```typescript
@ApiDynamicQuery({
  filters: ['user.name'],   // nested filter
  includes: ['user'],       // parent relation required
})
```

---

### Native search not working

**Cause:** Endpoint does not declare `search` in `RulesConfig`, or the fields were configured with raw database column names instead of entity property names.

**Fix:**
```typescript
@ApiDynamicQuery({
  search: ['name', 'email', 'company.name'],
})
```

**Important:**
- `search` is optional — only add it to endpoints that need quick text search
- Use entity field paths (`createdAt`, `firstName`, `overallStatus`)
- Nested search is supported with dot notation (`company.name`, `items.company.cnpj`)

---

### Swagger UI filters not working

**Cause:** Missing `dqbSwaggerRequestInterceptor` in Swagger setup.

**Fix:**
```typescript
import { dqbSwaggerRequestInterceptor } from '@multitechbr/nestjs-dynamic-query-builder';

SwaggerModule.setup('docs', app, document, {
  swaggerOptions: {
    requestInterceptor: dqbSwaggerRequestInterceptor,
  },
});
```

This is only needed for Swagger UI browser testing. HTTP clients work without it.

---

### QueryBuilderService not injectable

**Cause:** `DynamicQueryBuilderModule.forRoot()` not registered in `AppModule`.

**Fix:** Add to AppModule imports:
```typescript
@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot(),
  ],
})
export class AppModule {}
```

The module is `@Global()` — register only once in AppModule.

---

### Operator not recognized / 400 error on valid operator

**Cause:** Global operator restriction via `forRoot` configuration.

**Fix:** Check your `operators.allowed` config:
```typescript
DynamicQueryBuilderModule.forRoot({
  operators: {
    allowed: ['eq', 'ne', 'like', 'ilike', 'in', 'between'], // is operator listed?
  },
})
```

If `operators.allowed` is not set (undefined), all 13 operators are available.
