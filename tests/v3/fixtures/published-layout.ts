/**
 * O núcleo carregado como o pacote publicado o carrega: numa cópia separada
 * da que os adapters usam.
 *
 * O `tsup` gera um bundle por subpath sem chunk compartilhado, então
 * `nestjs-rest-query` e `nestjs-rest-query/typeorm` (e `/prisma`, `/drizzle`)
 * trazem **cada um a sua cópia** de `DecimalValue`, `CivilDate` e
 * `RestQueryError`. O plano nasce no núcleo do root e é compilado pelo adapter
 * do subpath. A suíte importava tudo de `src/`, ou seja de uma cópia só, e por
 * isso nunca viu o bug #1 do relato de consumidor externo: o `instanceof
 * DecimalValue` do adapter falhava contra o valor do núcleo, o objeto chegava
 * ao driver e o `pg` o serializava como `'"29.90"'`.
 *
 * `jest.isolateModules` dá ao núcleo um registro de módulos próprio — é a
 * mesma topologia de dois bundles, sem depender de `dist/`. Os ORMs não entram
 * aqui: o núcleo não importa nenhum, e os adapters seguem no registro normal,
 * junto com a conexão do teste.
 */
type CoreModule = typeof import('@core/query-builder.v3.service');

let isolated: CoreModule | undefined;

export function publishedQueryBuilderService(): CoreModule['QueryBuilderService'] {
  if (!isolated) {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      isolated = require('@core/query-builder.v3.service') as CoreModule;
    });
  }
  return isolated!.QueryBuilderService;
}

/** `DecimalValue`/`CivilDate` da cópia isolada, para testes de identidade. */
export function isolatedCoercion(): typeof import('@core/coercion') {
  let coercion: typeof import('@core/coercion') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    coercion = require('@core/coercion') as typeof import('@core/coercion');
  });
  return coercion!;
}
