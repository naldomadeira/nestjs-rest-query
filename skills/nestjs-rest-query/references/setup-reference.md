# Setup Reference

## Prerequisites

| Dependency        | Version   | Required                    |
| ----------------- | --------- | --------------------------- |
| NestJS            | `^11.0.0` | Yes                         |
| Node.js           | `>= 20`   | Yes                         |
| TypeORM           | `^0.3.26` | If using the TypeORM adapter (default) |
| `@nestjs/typeorm` | `^11.0.0` | If using the TypeORM adapter |
| Drizzle ORM       | `^0.45`   | If using the Drizzle adapter |
| `@nestjs/swagger` | `^11.0.0` | Only for `@ApiDynamicQuery` |

## Installation

The package is published publicly on npm with provenance via GitHub Actions Trusted Publishing — no private registry config required.

```bash
pnpm add nestjs-rest-query
# or: npm install / yarn add
```

## Bootstrap — `main.ts`

Both query parser and ValidationPipe are **mandatory**. Missing either causes silent or hard-to-debug failures.

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. REQUIRED: Extended query parser
  // Without this, filter[field][op]=value is NOT parsed correctly.
  // NestJS default parser does not expand nested bracket syntax.
  app.set('query parser', 'extended');

  // 2. REQUIRED: ValidationPipe with implicit conversion
  // enableImplicitConversion converts "10" -> 10 for page/perPage.
  // Without transform:true, DynamicQueryDto fields remain raw strings.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 3. OPTIONAL: Swagger setup with DQB interceptor
  // Only needed if you use @ApiDynamicQuery and want to test filters in Swagger UI.
  const config = new DocumentBuilder().setTitle('API').setVersion('1.0').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { requestInterceptor: dqbSwaggerRequestInterceptor },
  });

  await app.listen(3000);
}
bootstrap();
```

## Module registration — `app.module.ts`

`DynamicQueryBuilderModule` is `@Global()`. Register in `AppModule` only — do NOT register in feature modules.

### TypeORM (default adapter)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* your config */ }),
    DynamicQueryBuilderModule.forRoot(),
  ],
})
export class AppModule {}
```

### Drizzle adapter

Pass an explicit adapter; everything else stays the same.

```typescript
import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { DrizzleAdapter } from 'nestjs-rest-query/drizzle';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      adapter: new DrizzleAdapter(),
    }),
  ],
})
export class AppModule {}
```

When you call `queryBuilderService.execute(source, query, rules)`, the first argument switches per adapter:

- TypeORM → a TypeORM `Repository<T>`
- Drizzle → a `DrizzleSource` object describing your table and relations

### Full configuration

```typescript
DynamicQueryBuilderModule.forRoot({
  // Optional: swap adapter (default is TypeORM)
  adapter: new DrizzleAdapter(),

  pagination: {
    defaultPerPage: 10, // Items per page when not specified (default: 10)
    maxPerPage: 100,    // Maximum allowed perPage value (default: 100)
  },

  operators: {
    // Restrict globally which operators are available.
    // undefined = all 14 operators allowed.
    allowed: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'notIn', 'between', 'isNull'],
  },

  logging: {
    enabled: false,    // Enable query builder logging (default: false)
    level: 'info',     // 'error' | 'warn' | 'info' | 'debug'
    logger: undefined, // Custom logger instance (must implement LoggerLike)
  },
});
```

## Verification checklist

After setup, verify with this request:

```
GET /your-endpoint?page=1&perPage=5
```

Expected: paginated response with `data`, `page`, `perPage`, `total`, `lastPage`.

If you get an error or unexpected response:

1. Check `query parser` is set to `'extended'`.
2. Check `ValidationPipe` has `enableImplicitConversion: true`.
3. Check `DynamicQueryBuilderModule.forRoot()` is in `AppModule.imports`.
4. Check your endpoint uses `@ApiDynamicQuery` or `@DynamicQuery` with `@QueryRules()`.
5. If using Drizzle, confirm the adapter is registered: `forRoot({ adapter: new DrizzleAdapter() })`.
