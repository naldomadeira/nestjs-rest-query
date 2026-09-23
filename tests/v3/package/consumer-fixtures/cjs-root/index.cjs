const vm = require('node:vm');
const api = require('nestjs-rest-query');

if (typeof api.defineQueryRules !== 'function') {
  throw new Error('missing defineQueryRules');
}
if (typeof api.defineQuerySchema !== 'function') {
  throw new Error('missing defineQuerySchema');
}
if (api.TypeOrmAdapter !== undefined) {
  throw new Error('root leaked an adapter class');
}

const loaded = Object.keys(require.cache).join('\n');
for (const peer of ['typeorm', 'drizzle-orm', '@prisma/client']) {
  if (loaded.includes(`node_modules/${peer}/`)) {
    throw new Error(`root loaded the optional peer ${peer}`);
  }
}

// ---------------------------------------------------------------------------
// Regressões que só existem no pacote publicado (relato de consumidor externo).
//
// A suíte da biblioteca importa tudo de `src/`, ou seja de uma cópia só de
// cada módulo. O tarball tem um bundle por subpath, e é na fronteira entre
// eles que os bugs #1 e #3 moravam. O subpath do Prisma não carrega peer
// nenhum em runtime, então ele serve de adapter real aqui sem instalar ORM.
// ---------------------------------------------------------------------------

const {
  prismaSource,
  createPrismaManifest,
} = require('nestjs-rest-query/prisma');

const schema = api.defineQuerySchema({
  model: 'product',
  primaryKey: ['id'],
  fields: [
    { path: 'id', kind: 'integer', nullable: false, primaryKey: true },
    { path: 'price', kind: 'decimal', nullable: false, primaryKey: false },
    { path: 'releasedOn', kind: 'date', nullable: false, primaryKey: false },
  ],
  relations: [],
});
const registry = new Map([['product', schema]]);
const rules = api.defineQueryRules(registry, 'product', {
  filters: [
    { path: 'price', operators: ['eq', 'gte', 'lte', 'between'] },
    { path: 'releasedOn', operators: ['eq', 'between'] },
  ],
  sorts: ['id'],
  fields: { root: { allowed: ['id', 'price'], default: ['id', 'price'] } },
});

const calls = [];
let rowsToReturn = [];
const client = {
  product: {
    findMany: async (args) => {
      calls.push(args);
      return rowsToReturn;
    },
    count: async () => rowsToReturn.length,
  },
};
const source = prismaSource({
  client,
  model: 'product',
  manifest: createPrismaManifest({
    provider: 'postgresql',
    registry,
    models: { product: { delegate: 'product' } },
  }),
});
const service = new api.QueryBuilderService({});

/** Falha se algum valor de bind não for primitivo, `Date` ou lista. */
function assertDriverValues(value, path) {
  if (value === null || typeof value !== 'object') return;
  if (value instanceof Date) return;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype) {
    throw new Error(
      `#1: ${path} reached the ORM as ${prototype.constructor.name}, not as a driver value`
    );
  }
  for (const [key, inner] of Object.entries(value)) {
    assertDriverValues(inner, `${path}.${key}`);
  }
}

async function main() {
  // #1 — decimal/date filtrados pelo núcleo do root e compilados pelo adapter
  // de outro bundle. Antes, o `instanceof DecimalValue` do adapter falhava e o
  // objeto chegava ao driver (`'"29.90"'` no PostgreSQL).
  await service.execute(
    source,
    {
      filter: {
        price: { gte: '10.00', between: '29.90,99.90' },
        releasedOn: { eq: '2026-01-31' },
      },
    },
    rules
  );
  assertDriverValues(calls[0].where, 'where');
  if (!JSON.stringify(calls[0].where).includes('"29.90"')) {
    throw new Error('#1: the decimal filter did not reach the ORM');
  }

  // O mesmo defeito, do lado de lá: `instanceof` entre o build CJS e o ESM.
  const esm = await import('nestjs-rest-query');
  if (!(new esm.DecimalValue('1.5') instanceof api.DecimalValue)) {
    throw new Error('#1: DecimalValue identity differs between CJS and ESM');
  }

  // #6 — `paginate=false` tem teto global (default `maxPerPage` = 100), busca
  // no máximo teto + 1 linhas e recusa em vez de truncar.
  calls.length = 0;
  rowsToReturn = Array.from({ length: 101 }, (_, id) => ({ id, price: '1' }));
  let refused = null;
  try {
    await service.execute(source, { paginate: 'false' }, rules);
  } catch (error) {
    refused = error.getResponse ? error.getResponse() : error;
  }
  if (calls[0].take !== 101) {
    throw new Error(`#6: unpaginated query fetched take=${calls[0].take}`);
  }
  if (!refused || refused.code !== 'PAGINATION_INVALID') {
    throw new Error('#6: paginate=false over the cap was not refused');
  }

  // #3 — o interceptor do Swagger roda no browser a partir de `toString()`,
  // sem nenhum escopo deste pacote. Um contexto `vm` vazio é esse browser.
  const interceptor = api.dqbSwaggerRequestInterceptor({
    paths: { '/products': { get: { 'x-dqb-dynamic-query': true } } },
  });
  const inBrowser = vm.runInNewContext(`(${interceptor.toString()})`, {
    console,
  });
  const request = inBrowser({
    method: 'GET',
    url: '/products?filter=%5Bprice%5D%5Bgte%5D%3D10&page=1',
  });
  if (request.url !== '/products?filter%5Bprice%5D%5Bgte%5D=10&page=1') {
    throw new Error(`#3: serialized interceptor produced ${request.url}`);
  }

  console.log('cjs ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
