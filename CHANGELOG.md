# Changelog

## 2.0.0

### Major Changes

- [`645d597`](https://github.com/naldomadeira/nestjs-rest-query/commit/645d5973080f27570e38d2bcabd1c6c7682fb6f7) Thanks [@naldomadeira](https://github.com/naldomadeira)! - First public open source release as `nestjs-rest-query`.

  Renamed from the internal `@multitechbr/nestjs-dynamic-query-builder` (GitLab). Same library, MIT-licensed, on npm.
  - Public package on the npm registry.
  - MIT license.
  - TypeORM support.
  - Prisma and Drizzle support coming soon.

  See [MIGRATION.md](./MIGRATION.md) for upgrade notes from the previous internal package.

## [4.0.2-beta.0] - 2026-04-07

### Added

- `EntityPaths<T>` exportado publicamente para gerar paths tipados em dot-notation
- `RulesConfig<T>` com suporte genérico para tipagem forte dos campos permitidos

### Changed

- `@ApiDynamicQuery` agora aceita genérico (`@ApiDynamicQuery<T>()`) para inferência e validação de campos por entidade
- `@DynamicQuery` agora aceita genérico (`@DynamicQuery<T>()`) para manter consistência de tipagem com `RulesConfig<T>`
- Exemplo `02-app-with-postgres` atualizado para usar genéricos em `@ApiDynamicQuery<T>` e `@ApiPaginatedResponse<T>`
- `nest-cli.json` do exemplo `02-app-with-postgres` configurado com plugin do `@nestjs/swagger` para melhorar introspecção de tipos/comentários

## [4.0.1] - 2026-04-06

### Fixed

- `coerceValue` não remove mais zeros à esquerda de strings numéricas (ex: CPF, CEP, documentos)
- `coerceValue` preserva inteiros que excedem `Number.MAX_SAFE_INTEGER` como string, evitando perda silenciosa de precisão
- `coerceValue` preserva floats com zero à esquerda como string (ex: `"007.5"`)

### Added

- Testes para `applySearch` handler (busca textual)

## [4.0.0] - 2026-04-02

### Added

- `RulesConfig.search`: busca textual nativa por múltiplos campos com `?search=`
- `QueryInput.search` e `DynamicQueryDto.search`
- `applySearch` no pipeline `filters -> includes -> search -> fields -> sorts`
- Reaproveitamento/criação automática de joins para busca em relações aninhadas
- Documentação Swagger para `search` quando configurado em `@ApiDynamicQuery`

### Changed

- Exemplo `02-app-with-postgres` ajustado para propriedades em `camelCase` com colunas `snake_case`
- Exemplos `.http` do app `02-app-with-postgres` atualizados para o novo contrato em `camelCase`
- Skill `nestjs-dynamic-query-builder` dentro do exemplo `02-app-with-postgres` atualizada com `search` opcional, guidance de `camelCase` e uso de `customize` com SQL manual

### Fixed

- Exemplo `02-app-with-postgres` agora declara `dotenv` explicitamente
- Escape do `LIKE` na busca textual ajustado para compatibilidade com Postgres

## [3.0.0] - 2026-03-05

### Breaking Changes

- `PaginationConfig`: `defaultLimit` e `maxLimit` renomeados para `defaultPerPage` e `maxPerPage`
- `LoggingConfig`: campo `format` removido (era específico do Winston); substituído por `logger` para injeção de logger customizado
- `DynamicQueryDto`: campo `include` renomeado para `includes`; index signature de filtros substituído por campo `filter` explícito
- `QueryInput`: campo `include` renomeado para `includes`
- Parâmetro HTTP de relacionamentos muda de `?include=` para `?includes=`
- Operador `notNull` removido — use `isNull: false` para o mesmo resultado
- `InjectQueryBuilder` decorator removido — use injeção direta via construtor
- `PaginationQueryDto` convertido de classe para type alias de `DynamicQueryDto`

### Added

- `LoggerLike`: interface pública para injeção de logger customizado (`LoggingConfig.logger`)
- `@DynamicQuery(rules)`: decorator para endpoints sem Swagger (equivalente a `@ApiDynamicQuery` sem geração de docs)
- Documentação Swagger dos operadores exibida como tabela markdown
- Lógica Swagger extraída para `dqb-swagger.builder.ts` — `@ApiDynamicQuery` delega para o builder
- `@nestjs/swagger` tratado como opcional em runtime — lib não quebra sem ele instalado
- `package.json`: `keywords`, `exports`, scripts `clean`, `typecheck` e `prepublishOnly`

### Changed

- Estrutura `src/` reorganizada em `core/`, `api/`, `domain/`, `contracts/` e `infra/`
- Winston substituído por NestJS `Logger` como padrão — Winston não é mais dependência
- `DQBLogger.noop()` retorna singleton (sem instância nova a cada chamada)
- `DynamicQueryBuilderModule.globalConfig` (mutável) substituído por variável de módulo com `Object.freeze` e getter read-only
- `coerceForIsNull` removido dos normalizers — substituído por `toBool(value, false)`
- `peerDependencies` alinhadas para NestJS 11; `reflect-metadata` movido de `dependencies` para `peerDependencies`
- `DynamicQueryDto` achatado — sem herança de `PaginationQueryDto`
- Documentação JSDoc em `RulesConfig.fields` explica acoplamento com sorts
- Comentários nos operadores `like`, `ilike` e `notIlike` sobre portabilidade entre bancos
