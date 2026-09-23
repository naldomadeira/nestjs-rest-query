# Upgrading 2.x → 3.x

The ordered, authoritative path is **`MIGRATION.md`, section "2.x → 3.x"** in the
library repo
(<https://github.com/naldomadeira/nestjs-rest-query/blob/main/MIGRATION.md#2x--3x>);
the per-topic reference is `docs/v3/migration-from-v2.md` (Portuguese). Walk the
steps in that order and finish each before the next — the application does not
compile halfway through. Done when the app boots, every list endpoint has a
schema + rules pair, and the consumer's clients were told about the wire changes
below.

Checklist the steps map to:

1. Peers: TypeORM `^0.3.26 || ^1`, Drizzle `>=1.0.0-rc.4 <1.0.0` (0.45 is
   refused), Prisma `^6.19 || ^7`.
2. `forRoot`: remove `adapter` and `operators` (refused at boot).
3. Replace each `RulesConfig` with `defineQuerySchema` (per model) +
   `defineQueryRules` (per endpoint): operators move per field, every nested
   path is listed explicitly (prefix matching is gone).
4. `execute(repository, …)` → `execute(typeormSource(repository), …)`;
   Drizzle/Prisma sources per `references/v3/adapters.md`; the `customize`
   callback moves to `options.customize`.
5. Database migrations: folded columns for every `ilike`/`search` field, a
   portable-order column for `uuid` primary keys.
6. `@ApiDynamicQuery<T>({ … })` → `@ApiDynamicQuery(compiledRules)`.
7. Tell clients: `sorts` → `sort`; unknown params are 400; `%`/`_` are
   literals; `in=[]` matches nothing; errors carry a `code`; the PK is not
   injected into the JSON; `paginate=false` is capped.
