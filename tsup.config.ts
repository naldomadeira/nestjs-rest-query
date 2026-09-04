import { defineConfig } from 'tsup';

/**
 * Build dual ESM/CJS com um entry por subpath público (spec §20).
 *
 * Cada peer de ORM fica em `external`, de modo que o bundle do root não
 * carregue nenhum deles: importar `nestjs-rest-query` num projeto sem TypeORM
 * instalado precisa funcionar.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    typeorm: 'src/infra/adapters/typeorm/index.ts',
    prisma: 'src/infra/adapters/prisma/index.ts',
    drizzle: 'src/infra/adapters/drizzle/index.ts',
  },
  format: ['cjs', 'esm'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.mjs' }),
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node22',
  external: [
    'typeorm',
    'drizzle-orm',
    '@prisma/client',
    /^@nestjs\//,
    'reflect-metadata',
    'rxjs',
  ],
  tsconfig: 'tsconfig.build.json',
});
