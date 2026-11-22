# 3.x setup

## Install

```bash
pnpm add nestjs-rest-query            # `latest` is 3.x; `@^2` pins the previous major
```

Peers (all ORM peers optional — install the one you use):

| Peer              | Range                              | Notes                                                                  |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `@nestjs/common`  | `^11.0.0`                          |                                                                        |
| `typeorm`         | `^0.3.26 \|\| ^1.0.0`              | `@nestjs/typeorm` 11 (CJS) pairs with 0.3; `@nestjs/typeorm` 12 is ESM |
| `@prisma/client`  | `^6.19.0 \|\| ^7.0.0`              | 7 needs a driver adapter (`@prisma/adapter-pg`, …)                     |
| `drizzle-orm`     | `^0.45.0 \|\| >=1.0.0-rc.4 <1.0.0` | `0.45.x` on PostgreSQL/MySQL; SQL Server needs the 1.x RCs             |
| `@nestjs/swagger` | `^11.0.0`                          | only for `@ApiDynamicQuery` / `@ApiPaginatedResponse`                  |

Adapters live in subpaths — `nestjs-rest-query/typeorm`, `/prisma`, `/drizzle`.
The root never loads an ORM and exports no adapter class.

## `main.ts`

```typescript
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('query parser', 'extended'); // filter[field][op]=value → nested object
app.useGlobalPipes(new ValidationPipe({ transform: true }));
```

Fastify parses the query flat; hand it `qs`, with `allowDots: false` (relation
paths use dots):

```typescript
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { parse } from 'qs';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({
    routerOptions: {
      querystringParser: (q) =>
        parse(q, {
          depth: 3,
          parameterLimit: 100,
          arrayLimit: 100,
          allowDots: false,
        }),
    },
  })
);
```

`@Query() query: DynamicQueryDto` survives `ValidationPipe({ whitelist: true })`
from `3.0.0-alpha.2` on (its properties carry `@Allow()` when `class-validator`
is installed). Under `forbidNonWhitelisted`, or in ESM, read the raw query with
`@RestQuery() query: QueryInputLike` instead — global pipes skip it.

## `forRoot`

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: {
    defaultPerPage: 10,
    maxPerPage: 100, // perPage above it → 400, never clamped
    allowUnpaginated: true, // false → ?paginate=false is a 400 everywhere
    maxUnpaginatedRows: 100, // default: the effective maxPerPage
  },
  // past any → 400 QUERY_LIMIT_EXCEEDED; an endpoint may replace each key
  limits: {
    maxFilters: 20,
    maxListItems: 100,
    maxSorts: 5,
    maxSearchLength: 100,
    maxFilterValueLength: 255,
  },
  errors: { exposeInternalDetails: false }, // true: 500 bodies keep details (dev)
  textProfile: 'portable-strict', // the only implemented profile
  consistency: 'eventual', // 'transactional' is refused at boot
  logging: { enabled: false, level: 'info', redactValues: true },
});
```

Global, register once. `adapter` and `operators` are refused at startup with
`SOURCE_CONFIGURATION_INVALID` (they belong to the source and to the per-field
rules). `pagination.allowUnpaginated` / `maxUnpaginatedRows` exist from
`3.0.0-alpha.1`; `limits` and `errors` from `3.0.0`.

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
