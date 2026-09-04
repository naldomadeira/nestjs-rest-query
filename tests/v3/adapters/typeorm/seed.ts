import type { DataSource } from 'typeorm';
import { CORPUS_SEED } from '../../corpus/seed';
import { CompanyEntity, PostEntity, TagEntity, UserEntity } from './entities';

/**
 * Carrega o seed canônico do corpus.
 *
 * Insere via query builder, não via `save()`, para que os valores cheguem ao
 * banco exatamente como o corpus os declara — sem transformação de listener
 * nem coerção do repositório.
 */
export async function seedCorpus(dataSource: DataSource): Promise<void> {
  await dataSource.getRepository(TagEntity).clear();
  await dataSource.getRepository(PostEntity).clear();
  await dataSource
    .createQueryBuilder()
    .update(CompanyEntity)
    .set({ owner_id: null })
    .execute();
  await dataSource.getRepository(UserEntity).clear();
  await dataSource.getRepository(CompanyEntity).clear();

  await insert(
    dataSource,
    CompanyEntity,
    CORPUS_SEED.companies.map(({ id, name, name_folded }) => ({
      id,
      name,
      name_folded,
      owner_id: null,
    }))
  );

  await insert(
    dataSource,
    UserEntity,
    CORPUS_SEED.users.map((user) => ({
      ...user,
      score: user.score.toString(),
      created_at: new Date(user.created_at),
    }))
  );

  // Os donos só podem ser ligados depois que os usuários existem.
  for (const company of CORPUS_SEED.companies) {
    await dataSource
      .createQueryBuilder()
      .update(CompanyEntity)
      .set({ owner_id: company.owner_id })
      .where('id = :id', { id: company.id })
      .execute();
  }

  await insert(dataSource, PostEntity, [...CORPUS_SEED.posts]);
  await insert(dataSource, TagEntity, [...CORPUS_SEED.tags]);
}

async function insert(
  dataSource: DataSource,
  entity: new () => object,
  rows: readonly object[]
): Promise<void> {
  if (rows.length === 0) return;
  await dataSource
    .createQueryBuilder()
    .insert()
    .into(entity)
    .values(rows as never)
    .execute();
}
