import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDMMF } from '@prisma/internals';
import { MANIFEST } from './helpers';

/**
 * O manifesto escrito à mão não pode divergir do `schema.prisma`.
 *
 * Este é o gate que fecha o bloqueador nomeado no `status.md`: "o manifesto é
 * escrito à mão e pode divergir do `schema.prisma` sem que nada acuse". Sem
 * ele, renomear uma coluna no `schema.prisma`, trocar a cardinalidade de uma
 * relação ou mudar o provider passa verde — e o corpus continuaria medindo um
 * acordo entre duas mentiras consistentes.
 *
 * **O que este gate não pega, de propósito:** campos e relações são comparados
 * numa direção só, lógico ⊆ prisma. O schema lógico é whitelist, então ser um
 * subconjunto é legítimo — remover um campo de `CORPUS_SCHEMAS` continua
 * verde, e quem acusaria isso seria um caso do corpus deixando de passar, não
 * este arquivo. Só o eixo de *models* é bidirecional, porque ali sobra e falta
 * são ambos defeito.
 *
 * A comparação de models, campos, relações e chave primária usa `getDMMF`, o
 * mesmo parser que a CLI do Prisma usa: o valor do gate é ser autoritativo
 * sobre o que o Prisma entende, não sobre o que o texto parece dizer. A única
 * exceção é o provider, lido por expressão regular do bloco `datasource`,
 * porque o `getDMMF` devolve só o datamodel.
 *
 * O generator que derivaria o manifesto do `schema.prisma` foi adiado para a
 * `3.1.0` (ADR-001, emenda 3) precisamente porque comparar é mais fácil de
 * manter correto que derivar — e é o comparador que protege a paridade.
 */

const SCHEMA_PATH = join(__dirname, 'schema', 'schema.prisma');

interface DmmfField {
  name: string;
  kind: string;
  type: string;
  isList: boolean;
  isId: boolean;
}

interface DmmfModel {
  name: string;
  dbName: string | null;
  fields: DmmfField[];
  primaryKey: { fields: string[] } | null;
}

/** Propriedade do client gerada para um model: `User` -> `user`. */
const delegateOf = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1);

describe('o manifesto do Prisma acompanha o schema.prisma', () => {
  const datamodel = readFileSync(SCHEMA_PATH, 'utf8');
  let byDelegate: Map<string, DmmfModel>;

  beforeAll(async () => {
    const dmmf = await getDMMF({ datamodel });
    byDelegate = new Map(
      (dmmf.datamodel.models as unknown as DmmfModel[]).map((model) => [
        delegateOf(model.name),
        model,
      ])
    );
  }, 60_000);

  it('declara o provider do datasource, não outro', () => {
    // O provider decide dialeto e, com ele, se `%` e `_` podem ser literais.
    // Declarar o errado no manifesto tornaria as capabilities uma ficção.
    //
    // Único ponto lido por regex, porque `getDMMF` não devolve o bloco
    // `datasource`. Frágil se o bloco ganhar chave aninhada — se isso
    // acontecer, o caminho é `getConfig`, não um regex mais esperto.
    const declared = /datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"/m.exec(
      datamodel
    );

    expect(declared?.[1]).toBe(MANIFEST.provider);
  });

  const models = Object.entries(MANIFEST.models);

  it('cobre todos os models do schema.prisma, sem sobra nem falta', () => {
    // Um model no `schema.prisma` sem entrada no manifesto é um endpoint que
    // ninguém pode servir; o contrário é um delegate que não existe no client.
    const declared = models.map(([, entry]) => entry.delegate).sort();
    const inSchema = [...byDelegate.keys()].sort();

    expect(declared).toEqual(inSchema);
  });

  it.each(models)(
    '%s: o delegate existe como model no schema.prisma',
    (model, entry) => {
      expect(byDelegate.get(entry.delegate)).toBeDefined();
      expect(MANIFEST.registry.has(model)).toBe(true);
    }
  );

  it.each(models)(
    '%s: todo campo do schema lógico existe como escalar no schema.prisma',
    (model, entry) => {
      const prisma = byDelegate.get(entry.delegate)!;
      const scalars = new Set(
        prisma.fields.filter((f) => f.kind === 'scalar').map((f) => f.name)
      );
      const logical = MANIFEST.registry.get(model)!;

      // Endereçamento por path do schema lógico: o adapter não tem mapeamento
      // próprio de coluna, então um campo ausente aqui vira coluna inexistente
      // na query do Prisma.
      const missing = [...logical.fields.values()]
        .map((field) => field.path)
        .filter((path) => !scalars.has(path));

      expect(missing).toEqual([]);
    }
  );

  it.each(models)(
    '%s: toda relação do schema lógico existe com a mesma cardinalidade',
    (model, entry) => {
      const prisma = byDelegate.get(entry.delegate)!;
      const objects = new Map(
        prisma.fields
          .filter((f) => f.kind === 'object')
          .map((f) => [f.name, f] as const)
      );
      const logical = MANIFEST.registry.get(model)!;

      const wrong = [...logical.relations.values()]
        .map((relation) => {
          const field = objects.get(relation.path);
          if (!field) return `${relation.path}: ausente no schema.prisma`;

          const cardinality = field.isList ? 'many' : 'one';
          if (cardinality !== relation.cardinality) {
            return `${relation.path}: ${cardinality} no schema.prisma, ${relation.cardinality} no schema lógico`;
          }

          const target = byDelegate.get(delegateOf(field.type));
          if (!target || delegateOf(field.type) !== relation.target) {
            return `${relation.path}: aponta para ${field.type}, esperado ${relation.target}`;
          }

          return undefined;
        })
        .filter((problem): problem is string => problem !== undefined);

      expect(wrong).toEqual([]);
    }
  );

  it.each(models)(
    '%s: a chave primária é a mesma nos dois lados',
    (model, entry) => {
      const prisma = byDelegate.get(entry.delegate)!;
      const logical = MANIFEST.registry.get(model)!;

      // PK composta vem em `primaryKey.fields` (`@@id`); simples vem marcada
      // no campo (`@id`). O corpus tem os dois casos — `tag` é composta.
      const inSchema =
        prisma.primaryKey?.fields ??
        prisma.fields.filter((f) => f.isId).map((f) => f.name);

      expect([...inSchema].sort()).toEqual([...logical.primaryKey].sort());
    }
  );
});
