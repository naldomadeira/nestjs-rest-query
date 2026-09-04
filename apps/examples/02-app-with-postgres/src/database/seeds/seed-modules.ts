/**
 * Seed: Módulos
 *
 * Cria ou atualiza os módulos da aplicação (idempotente via upsert no slug).
 *
 * Uso:
 *   yarn seed:modules
 */
import { Repository } from 'typeorm';
import { Module } from '../../modules/entities/module.entity';
import { MODULES_SEED_DATA } from './data/modules.data';
import { seedDataSource } from './seed.datasource';
import { logger, runSeed } from './utils/seed.helpers';

async function seedModules(ds: typeof seedDataSource): Promise<void> {
  const repo: Repository<Module> = ds.getRepository(Module);

  logger.title('Seeding Módulos');
  logger.info(`Total de módulos a processar: ${MODULES_SEED_DATA.length}`);
  logger.divider();

  // `repo.create(...)` antes do upsert não é cerimônia: as factories devolvem
  // objetos literais, e o listener `@BeforeInsert` que preenche as colunas
  // dobradas só é disparado para instâncias da entidade. Sem isto o seed
  // gravaria `*_folded` vazio e `?search=` não encontraria nada.
  await repo.upsert(repo.create(MODULES_SEED_DATA), {
    conflictPaths: ['slug'],
    skipUpdateIfNoValuesChanged: true,
  });

  const saved = await repo.find({ order: { id: 'ASC' } });
  saved.forEach((m) =>
    logger.dim(`[${m.status.toUpperCase()}] ${m.name} (slug: ${m.slug})`),
  );

  logger.success(`${saved.length} módulo(s) no banco de dados.`);
}

runSeed(seedDataSource, seedModules);
