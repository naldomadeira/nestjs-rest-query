/**
 * Seed: Empresas
 *
 * Gera e insere N empresas com dados fictícios (via faker).
 * Idempotente via upsert no cnpj — re-executar não duplica.
 *
 * Uso:
 *   pnpm seed:companies
 *   pnpm seed:companies 50
 *   pnpm seed:companies --count 50
 */
import { Repository } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { makeCompanies } from './factories/company.factory';
import { seedDataSource } from './seed.datasource';
import { logger, parseCount, runSeed } from './utils/seed.helpers';

async function seedCompanies(ds: typeof seedDataSource): Promise<void> {
  const repo: Repository<Company> = ds.getRepository(Company);

  const count = parseCount(20);
  const data = makeCompanies(count);

  logger.title('Seeding Empresas');
  logger.info(`Empresas a gerar: ${count}`);
  logger.divider();

  // `repo.create(...)` antes do upsert não é cerimônia: as factories devolvem
  // objetos literais, e o listener `@BeforeInsert` que preenche as colunas
  // dobradas só é disparado para instâncias da entidade. Sem isto o seed
  // gravaria `*_folded` vazio e `?search=` não encontraria nada.
  await repo.upsert(repo.create(data), {
    conflictPaths: ['cnpj'],
    skipUpdateIfNoValuesChanged: true,
  });

  const saved = await repo.find({ order: { id: 'ASC' } });
  saved.forEach((c) => logger.dim(`[${c.id}] ${c.name} — CNPJ: ${c.cnpj}`));

  logger.success(`${saved.length} empresa(s) no banco de dados.`);
}

runSeed(seedDataSource, seedCompanies);
