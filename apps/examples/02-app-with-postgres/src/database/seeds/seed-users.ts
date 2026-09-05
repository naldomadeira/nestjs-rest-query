/**
 * Seed: Usuários
 *
 * Cria usuários fictícios no banco usando faker pt_BR.
 * Simula usuários vindos do Keycloak com ssoUserId como UUID.
 *
 * Uso:
 *   yarn seed:users              → cria 10 usuários
 *   yarn seed:users --count 30   → cria 30 usuários
 *
 * Nota: O seed sempre inclui 1 usuário admin fixo + N usuários gerados.
 */
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import {
  makeAdminUser,
  makeExternalUser,
  makeManagerUser,
} from './factories/user.factory';
import { seedDataSource } from './seed.datasource';
import { logger, parseCount, runSeed } from './utils/seed.helpers';

async function seedUsers(ds: typeof seedDataSource): Promise<void> {
  const repo: Repository<User> = ds.getRepository(User);

  const count = parseCount(10);

  logger.title('Seeding Usuários');
  logger.info(`Usuários a criar: ${count} aleatórios + 1 admin fixo`);
  logger.divider();

  // 1. Upsert do admin fixo
  const adminUser = makeAdminUser();
  // `repo.create(...)` antes do upsert não é cerimônia: as factories devolvem
  // objetos literais, e o listener `@BeforeInsert` que preenche as colunas
  // dobradas só é disparado para instâncias da entidade. Sem isto o seed
  // gravaria `*_folded` vazio e `?search=` não encontraria nada.
  await repo.upsert([repo.create(adminUser)], {
    conflictPaths: ['ssoUserId'],
    skipUpdateIfNoValuesChanged: true,
  });
  logger.success(`Admin: ${adminUser.email}`);

  // 2. Mix de tipos: 60% externos, 40% managers
  const managerCount = Math.floor(count * 0.4);
  const externalCount = count - managerCount;

  const managers = Array.from({ length: managerCount }, () =>
    makeManagerUser(),
  );
  const externals = Array.from({ length: externalCount }, () =>
    makeExternalUser(),
  );
  const randomUsers = [...managers, ...externals];

  let successCount = 0;
  let skipCount = 0;

  for (const user of randomUsers) {
    try {
      await repo.upsert([repo.create(user)], {
        conflictPaths: ['ssoUserId'],
        skipUpdateIfNoValuesChanged: true,
      });
      logger.dim(`✔ ${user.firstName} ${user.lastName} <${user.email}>`);
      successCount++;
    } catch {
      logger.warn(`Pulando usuário com dado duplicado: ${user.email}`);
      skipCount++;
    }
  }

  const total = await repo.count();
  logger.divider();
  logger.success(
    `${successCount} usuário(s) inseridos/atualizados. ${skipCount} pulados.`,
  );
  logger.info(`Total de usuários no banco: ${total}`);
}

runSeed(seedDataSource, seedUsers);
