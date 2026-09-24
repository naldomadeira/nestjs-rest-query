# 3.x setup

## Install

```bash
pnpm add nestjs-rest-query@alpha      # 3.x is a prerelease; `latest` is still 2.x
```

Peers (all ORM peers optional — install the one you use):

| Peer              | Range                 | Notes                                                                  |
| ----------------- | --------------------- | ---------------------------------------------------------------------- |
| `@nestjs/common`  | `^11.0.0`             |                                                                        |
| `typeorm`         | `^0.3.26 \|\| ^1.0.0` | `@nestjs/typeorm` 11 (CJS) pairs with 0.3; `@nestjs/typeorm` 12 is ESM |
| `@prisma/client`  | `^6.19.0 \|\| ^7.0.0` | 7 needs a driver adapter (`@prisma/adapter-pg`, …)                     |
| `drizzle-orm`     | `>=1.0.0-rc.4 <1.0.0` | `0.45.x` is **not** accepted                                           |
| `@nestjs/swagger` | `^11.0.0`             | only for `@ApiDynamicQuery` / `@ApiPaginatedResponse`                  |

Adapters live in subpaths — `nestjs-rest-query/typeorm`, `/prisma`, `/drizzle`.
The root never loads an ORM and exports no adapter class.

## `main.ts`

```typescript
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('query parser', 'extended'); // filter[field][op]=value → nested object
app.useGlobalPipes(new ValidationPipe({ transform: true }));
```

With `ValidationPipe({ whitelist: true })` (NestJS hardening default), do **not**
take the query through `@Query() query: DynamicQueryDto`: the DTO has no
class-validator decorators and the pipe strips every key — the endpoint answers
200 with the default page (open defect, see troubleshooting). Read the raw query
with a custom param decorator, which global pipes skip:

```typescript
export const ListQuery = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): QueryInput =>
    ctx.switchToHttp().getRequest<Request>().query as QueryInput
);
// list(@ListQuery() query: QueryInput, @QueryRules() rules: CompiledQueryRules)
```

## `forRoot`

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: {
    defaultPerPage: 10,
    maxPerPage: 500, // perPage above it → 400, never clamped
    allowUnpaginated: true, // false → ?paginate=false is a 400 everywhere
    maxUnpaginatedRows: 500, // default: the effective maxPerPage
  },
  textProfile: 'portable-strict', // the only implemented profile
  consistency: 'eventual', // 'transactional' is refused at boot
  logging: { enabled: false, level: 'info', redactValues: true },
});
```

Global, register once. `adapter` and `operators` are refused at startup with
`SOURCE_CONFIGURATION_INVALID` (they belong to the source and to the per-field
rules). `pagination.allowUnpaginated` / `maxUnpaginatedRows` exist from the
alpha after `3.0.0-alpha.0`.

## Swagger

```typescript
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document, {
  swaggerOptions: {
    requestInterceptor: dqbSwaggerRequestInterceptor(document),
  },
});
```

`@ApiDynamicQuery(rules)` documents the params (no type parameter in 3.x) and
marks the route; the interceptor rewrites what the user types in the `filter`
box (`[name][eq]=Ada`, several joined by `&`) into real `filter[...]` pairs.
`@nestjs/swagger` ships the interceptor to the browser as `fn.toString()`: on
`3.0.0-alpha.0` that function referenced module helpers and every "Try it out"
failed with `ReferenceError` — upgrade; on that exact version only, a local
self-contained function is the workaround. `@ApiPaginatedResponse(Model)`
documents the paginated envelope.
