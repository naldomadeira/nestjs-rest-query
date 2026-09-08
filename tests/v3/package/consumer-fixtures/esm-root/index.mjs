import * as api from 'nestjs-rest-query';

if (typeof api.defineQueryRules !== 'function') {
  throw new Error('missing defineQueryRules');
}
if (api.TypeOrmAdapter !== undefined) {
  throw new Error('root leaked an adapter class');
}

console.log('esm ok');
