import pkg from '../../../package.json';

describe('package exports', () => {
  it('publica os quatro subpaths do spec §20', () => {
    expect(Object.keys(pkg.exports)).toEqual([
      '.',
      './typeorm',
      './prisma',
      './drizzle',
      './package.json',
    ]);
  });

  it('cada subpath declara import e require com os tipos do próprio formato', () => {
    // Tipos por condição, e não um `types` no topo: com `type: commonjs`, um
    // `.d.ts` único faz o `attw` acusar o ESM de se passar por CJS.
    for (const key of ['.', './typeorm', './prisma', './drizzle'] as const) {
      expect(pkg.exports[key]).toEqual({
        import: {
          types: expect.stringMatching(/\.d\.mts$/),
          default: expect.stringMatching(/\.mjs$/),
        },
        require: {
          types: expect.stringMatching(/\.d\.ts$/),
          default: expect.stringMatching(/\.cjs$/),
        },
      });
    }
  });

  it('typesVersions espelha os subpaths de adapter', () => {
    expect(Object.keys(pkg.typesVersions['*'])).toEqual([
      'typeorm',
      'prisma',
      'drizzle',
    ]);
  });

  it('nenhum peer de ORM é dependency', () => {
    const dependencies = Object.keys(
      (pkg as { dependencies?: Record<string, string> }).dependencies ?? {}
    );
    for (const peer of ['typeorm', 'drizzle-orm', '@prisma/client']) {
      expect(dependencies).not.toContain(peer);
    }
  });

  it('todos os peers de ORM são opcionais', () => {
    for (const peer of ['typeorm', 'drizzle-orm', '@prisma/client'] as const) {
      expect(pkg.peerDependenciesMeta[peer].optional).toBe(true);
    }
  });

  it('as faixas de peer refletem a matriz suportada', () => {
    expect(pkg.peerDependencies.typeorm).toBe('^0.3.26 || ^1.0.0');
    expect(pkg.peerDependencies['drizzle-orm']).toBe('^1.0.0');
    expect(pkg.peerDependencies['@prisma/client']).toBe('^6.19.0 || ^7.0.0');
  });

  it('o entrypoint principal aponta para o bundle CJS', () => {
    expect(pkg.main).toBe('dist/index.cjs');
    expect(pkg.module).toBe('dist/index.mjs');
  });
});
