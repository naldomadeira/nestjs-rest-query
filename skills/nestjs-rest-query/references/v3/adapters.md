# 3.x sources and adapters

`execute(source, query, rules, options?)`. The source decides the adapter;
build it **once per service** (the source-vs-schema check is cached per source
instance — a source per request re-runs it every time).

## TypeORM — `nestjs-rest-query/typeorm`

```typescript
constructor(@InjectRepository(Product) repo: Repository<Product>, private readonly qb: QueryBuilderService) {
  this.source = typeormSource(repo, { fieldKinds: { id: 'uuid' } }); // fieldKinds: kinds the column type cannot reveal
}
```

- Rules and schema use **property** names; the adapter maps to physical
  columns, `@Column({ name })`, naming strategies and schemas
  (`@Entity({ schema })`, `DataSource({ schema })`). On `3.0.0-alpha.0` the
  `EXISTS` of a filter/search through a `many` relation used the property name
  unquoted and without schema → 500 on snake_case columns.
- `buildSchemaRegistry(repo)` derives the registry from entity metadata (only
  where a repository exists, i.e. not next to a decorator).
- Soft delete is TypeORM's: respected on root and joins.

## Prisma — `nestjs-rest-query/prisma`

```typescript
export const MANIFEST = createPrismaManifest({
  provider: 'postgresql', // must be the real provider: pattern ops depend on it
  registry: APP_SCHEMAS, // hand-written defineQuerySchema entries
  models: { company: { delegate: 'company' } },
});
prismaSource<CompanyRow>({
  client: this.prisma,
  model: 'company',
  manifest: MANIFEST,
});
```

Relations `many` → `some`/`none`, `one` → `is`/`isNot`; never
`mode: 'insensitive'`. Pattern operators are refused with
`CAPABILITY_UNAVAILABLE` on SQLite and SQL Server (no `ESCAPE`).

## Drizzle — `nestjs-rest-query/drizzle`

```typescript
export const companiesTable = createDrizzleTable({
  name: 'companies', model: 'company',
  columns: { id: { name: 'id', kind: 'uuid', nullable: false, primaryKey: true, portableOrderField: 'idOrder' }, … },
});
drizzleSource({ db: drizzleDatabase({ client, dialect: 'postgres' }), dialect: 'postgres', table: companiesTable, relations });
```

Column keys are logical, `name` is physical. `buildSourceSchema(table,
relations)` gives the schema. A collection nested under another relation fails
closed (`ADAPTER_CONTRACT_VIOLATION`).

## Hooks

- `transformPlan(plan)`: adapter-agnostic, runs before the plan is frozen
  (tenant scoping, forced filters).
- `customize(native)` + `customizeScope: 'both' | 'data' | 'count'` (default
  `both`): TypeORM gets the `SelectQueryBuilder`; Prisma `{ kind, args }`;
  Drizzle `{ kind, statement }`. A single-scope customize logs a warning — data
  and count may diverge.
