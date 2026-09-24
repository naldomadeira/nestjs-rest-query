---
'nestjs-rest-query': patch
---

fix(core): `forRoot({ portability: { enforce: true } })` is no longer discarded (consumer report #5)

`forRoot` built its frozen configuration from `pagination`, `textProfile`, `consistency` and `logging` only, so `portability` never reached `QueryBuilderService`. With `enforce: true`, a source without `portabilityProfile` still ran instead of failing with `PORTABILITY_PROFILE_MISMATCH`.

`portability` is now part of the resolved configuration (default `{ enforce: false }`, also visible in `DynamicQueryBuilderModule.config`), and `forRoot` rejects a non-boolean `enforce` with `SOURCE_CONFIGURATION_INVALID`.
