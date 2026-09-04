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

console.log('cjs ok');
