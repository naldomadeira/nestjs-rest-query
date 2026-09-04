import { createPrismaManifest } from 'nestjs-rest-query/prisma';
import type { PrismaManifest } from 'nestjs-rest-query/prisma';
import { APP_SCHEMAS } from './schemas';

/**
 * Manifesto do Prisma — **escrito à mão** (spec §15.2).
 *
 * É o passo mais caro da migração v2 → v3 para quem usa Prisma, e não há
 * ferramenta: o generator que derivaria isto do `schema.prisma` é lacuna
 * declarada para a 3.1.0. Na v2 a `PrismaSource` era montada inline no
 * serviço, com `model`, `primaryKeyField` e `relations` soltos; na v3 o
 * manifesto é um objeto único, validado na inicialização.
 *
 * O que ele amarra:
 *
 * - `provider` decide o dialeto e, com ele, o escape de padrão. Em
 *   `postgresql` e `mysql` o Prisma tem `\` como escape default do `LIKE`, e a
 *   biblioteca escapa o valor — `%` e `_` continuam literais como a §11 exige.
 *   Em `sqlite` e `sqlserver` não existe escape default, e os cinco operadores
 *   de padrão (`like`, `notLike`, `ilike`, `notIlike`, `search`) são recusados
 *   com `CAPABILITY_UNAVAILABLE` em vez de devolverem o conjunto errado
 *   (ADR-001, emenda 2). Declarar o provider errado aqui é a diferença entre
 *   um endpoint correto e um endpoint silenciosamente errado.
 * - `registry` é o schema lógico; `models` liga cada model do registry à
 *   propriedade do client (`prisma.user` -> `delegate: 'user'`).
 *
 * `createPrismaManifest` valida: model sem entrada no registry ou sem
 * `delegate` falha aqui, na subida, com `SOURCE_CONFIGURATION_INVALID`. O que
 * ele **não** valida é o inverso — que o campo declarado no schema exista de
 * fato no `schema.prisma`. Essa checagem não existe no caminho do Prisma.
 */
export const APP_MANIFEST: PrismaManifest = createPrismaManifest({
  provider: 'postgresql',
  registry: APP_SCHEMAS,
  models: {
    company: { delegate: 'company' },
    user: { delegate: 'user' },
    post: { delegate: 'post' },
  },
});
