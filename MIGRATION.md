# Migration Guide

## From `@multitechbr/nestjs-dynamic-query-builder` to `nestjs-rest-query`

This library was previously published as `@multitechbr/nestjs-dynamic-query-builder` on a private GitLab registry. It has been renamed and released as the public, MIT-licensed `nestjs-rest-query` on npm.

### Install

```bash
pnpm remove @multitechbr/nestjs-dynamic-query-builder
pnpm add nestjs-rest-query
```

You can also remove the GitLab `.npmrc` configuration that was required to access the private registry — it is no longer needed.

### Imports

In the **first 1.0.0 release** the package name changes but the public API identifiers remain the same as in `4.x`. Replace only the import path:

```diff
- import { DynamicQueryBuilderModule } from '@multitechbr/nestjs-dynamic-query-builder';
+ import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
```

### Behavior

Behavior is preserved 1:1. Whitelist semantics, all 15 operators, pagination shape, sort/field/include/search handlers, Swagger integration — all unchanged.

### Public API rename (planned)

A future release will rename the public API surface to align with the new package name:

| Today (1.0.0)             | Planned                  |
|---------------------------|--------------------------|
| `DynamicQueryBuilderModule` | `RestQueryModule`        |
| `QueryBuilderService`     | `RestQueryService`       |
| `@DynamicQuery`           | `@RestQuery`             |
| `@ApiDynamicQuery`        | `@ApiRestQuery`          |
| `RulesConfig`             | `RestQueryRules`         |
| `QueryInput`              | `RestQueryInput`         |
| `QueryResult`             | `RestQueryResult`        |
| `QueryBuilderConfig`      | `RestQueryConfig`        |
| `DQB_CONFIG_TOKEN`        | `REST_QUERY_CONFIG`      |
| `dqbSwaggerRequestInterceptor` | `restQuerySwaggerInterceptor` |
| `DynamicQueryDto`         | `RestQueryDto`           |

That rename will ship in a major version bump with this guide updated. Track progress in the [migration plan](./plans/migration-to-github-and-npm/).

### License

Changed from ISC (internal) to **MIT** (public).

### Reporting issues during migration

If anything broke after the upgrade, open an issue:
https://github.com/naldomadeira/nestjs-rest-query/issues
