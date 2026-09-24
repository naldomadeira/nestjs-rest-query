---
'nestjs-rest-query': patch
---

fix(api): `@Query() query: DynamicQueryDto` survives `ValidationPipe({ whitelist: true })`, and new `@RestQuery()` (consumer report #4)

`DynamicQueryDto` had no class-validator decorators, so a global `ValidationPipe({ whitelist: true })` stripped all eight properties and the handler received an empty object — no `400` (Nest forces `forbidUnknownValues: false`), the query simply stopped filtering, sorting and paginating.

- When `class-validator` is installed, `page`, `perPage`, `paginate`, `sort`, `fields`, `includes`, `filter` and `search` are now marked with `@Allow()`, so the whitelist keeps them (nested `filter` included). `class-validator` is now an optional peer dependency — declared so that strict layouts like pnpm's let this package resolve the consumer's copy — and it is loaded lazily: nothing happens when it is absent. This applies to the CommonJS build, which is how Nest apps load the package.
- New `@RestQuery()` param decorator returns the raw `request.query` (typed `QueryInputLike`, now exported as a type). `ValidationPipe` does not touch it, so it also works under `forbidNonWhitelisted: true` and in ESM apps. Unknown params are still rejected by `execute()` with `QUERY_SYNTAX_UNKNOWN_PARAM`.
