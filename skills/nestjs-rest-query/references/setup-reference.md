# Setup Reference

## Prerequisites

| Dependency | Version | Required |
|------------|---------|----------|
| NestJS | ^11.0.0 | Yes |
| Node.js | >= 20 | Yes |
| TypeORM | ^0.3.26 | Yes |
| @nestjs/typeorm | ^11.0.0 | Yes |
| @nestjs/swagger | ^11.0.0 | Only for `@ApiDynamicQuery` |

## NPM Registry Configuration

The package is hosted on GitLab's npm registry. Create `.npmrc` at project root:

```ini
@multitechbr:registry=https://gitlab.com/api/v4/packages/npm
//gitlab.com/api/v4/packages/npm/:_authToken=${CI_JOB_TOKEN}
//gitlab.com/api/v4/projects/73898570/packages/npm/:_authToken=${CI_JOB_TOKEN}
```

**CI/CD:** `CI_JOB_TOKEN` is auto-injected by GitLab CI.
**Local development:** Replace `${CI_JOB_TOKEN}` with a GitLab Personal Access Token (scope: `read_api`).

> Never commit tokens to git. Use environment variables or `.npmrc` in your home directory.

## Bootstrap — main.ts

All three configurations are **mandatory**. Missing any one causes silent failures.

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { dqbSwaggerRequestInterceptor } from '@multitechbr/nestjs-dynamic-query-builder';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. REQUIRED: Extended query parser
  // Without this, filter[field][op]=value is NOT parsed correctly.
  // NestJS default parser does not expand nested bracket syntax.
  app.set('query parser', 'extended');

  // 2. REQUIRED: ValidationPipe with implicit conversion
  // enableImplicitConversion converts string "10" to number 10 for page/perPage.
  // Without transform:true, DynamicQueryDto fields remain raw strings.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 3. OPTIONAL: Swagger setup with DQB interceptor
  // Only needed if you use @ApiDynamicQuery and want to test filters in Swagger UI.
  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      requestInterceptor: dqbSwaggerRequestInterceptor,
    },
  });

  await app.listen(3000);
}
bootstrap();
```

## Module Registration — app.module.ts

`DynamicQueryBuilderModule` is `@Global()`. Register in `AppModule` only — do NOT register in feature modules.

### Minimal (recommended for most projects)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DynamicQueryBuilderModule } from '@multitechbr/nestjs-dynamic-query-builder';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* your config */ }),
    DynamicQueryBuilderModule.forRoot(),
  ],
})
export class AppModule {}
```

### Full Configuration

```typescript
DynamicQueryBuilderModule.forRoot({
  pagination: {
    defaultPerPage: 10,   // Items per page when not specified (default: 10)
    maxPerPage: 100,       // Maximum allowed perPage value (default: 100)
  },
  operators: {
    // Restrict globally which operators are available.
    // undefined = all 13 operators allowed.
    allowed: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'notIn', 'between', 'isNull'],
  },
  logging: {
    enabled: false,        // Enable query builder logging (default: false)
    level: 'info',         // 'error' | 'warn' | 'info' | 'debug'
    logger: undefined,     // Custom logger instance (must implement LoggerLike)
  },
})
```

## Verification Checklist

After setup, verify with this request:

```
GET /your-endpoint?page=1&perPage=5
```

Expected: Paginated response with `data`, `page`, `perPage`, `total`, `lastPage`.

If you get an error or unexpected response:
1. Check `query parser` is set to `'extended'`
2. Check `ValidationPipe` has `enableImplicitConversion: true`
3. Check `DynamicQueryBuilderModule.forRoot()` is in AppModule imports
4. Check your endpoint uses `@ApiDynamicQuery` or `@DynamicQuery` with `@QueryRules()`
