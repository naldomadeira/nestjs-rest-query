/**
 * Seed: Fluxo Completo
 *
 * Executa todos os seeds em sequência na ordem correta:
 *   1. Módulos    (upsert por slug)
 *   2. Empresas   (upsert por cnpj)
 *   3. Usuários   (upsert por ssoUserId)
 *   4. Access Requests (sempre cria novos)
 *
 * Uso:
 *   yarn seed:full
 *   yarn seed:full --users 20 --companies 10 --requests 3
 *
 * Parâmetros opcionais:
 *   --users     <n>    Quantidade de usuários a criar    (padrão: 10)
 *   --companies <n>    Quantidade de empresas da lista   (padrão: todas)
 *   --requests  <n>    Access requests por usuário       (padrão: 2)
 */
import { DataSource, Repository } from 'typeorm';
import { AccessRequestItem } from '../../access-requests/entities/access-request-item.entity';
import { AccessRequest } from '../../access-requests/entities/access-request.entity';
import { Company } from '../../companies/entities/company.entity';
import { Module } from '../../modules/entities/module.entity';
import { User } from '../../users/entities/user.entity';
import { COMPANIES_SEED_DATA } from './data/companies.data';
import { MODULES_SEED_DATA } from './data/modules.data';
import { makeAccessRequestsForUser } from './factories/access-request.factory';
import {
  makeAdminUser,
  makeExternalUser,
  makeManagerUser,
} from './factories/user.factory';
import { seedDataSource } from './seed.datasource';
import { logger, runSeed } from './utils/seed.helpers';

// ─── Parse CLI args ───────────────────────────────────────────────────────────

function parseArg(flag: string, defaultValue: number): number {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    const n = parseInt(process.argv[idx + 1], 10);
    return isNaN(n) ? defaultValue : Math.max(1, n);
  }
  return defaultValue;
}

const USER_COUNT = parseArg('--users', 10);
const COMPANY_COUNT = parseArg('--companies', COMPANIES_SEED_DATA.length);
const REQUESTS_PER_USER = parseArg('--requests', 2);

// ─── Steps ────────────────────────────────────────────────────────────────────

async function stepModules(ds: DataSource): Promise<Module[]> {
  const repo: Repository<Module> = ds.getRepository(Module);

  logger.title('Passo 1/4 — Módulos');
  // `repo.create(...)` antes do upsert não é cerimônia: as factories devolvem
  // objetos literais, e o listener `@BeforeInsert` que preenche as colunas
  // dobradas só é disparado para instâncias da entidade. Sem isto o seed
  // gravaria `*_folded` vazio e `?search=` não encontraria nada.
  await repo.upsert(repo.create(MODULES_SEED_DATA), {
    conflictPaths: ['slug'],
    skipUpdateIfNoValuesChanged: true,
  });
  const modules = await repo.find({ order: { id: 'ASC' } });
  modules.forEach((m) => logger.dim(`  [${m.status}] ${m.name}`));
  logger.success(`${modules.length} módulo(s) processados.`);
  return modules;
}

async function stepCompanies(ds: DataSource): Promise<Company[]> {
  const repo: Repository<Company> = ds.getRepository(Company);

  logger.title('Passo 2/4 — Empresas');
  const data = COMPANIES_SEED_DATA.slice(0, COMPANY_COUNT);
  await repo.upsert(repo.create(data), {
    conflictPaths: ['cnpj'],
    skipUpdateIfNoValuesChanged: true,
  });
  const companies = await repo.find({ order: { id: 'ASC' } });
  companies.forEach((c) => logger.dim(`  ${c.name} — ${c.cnpj}`));
  logger.success(`${companies.length} empresa(s) processadas.`);
  return companies;
}

async function stepUsers(ds: DataSource): Promise<User[]> {
  const repo: Repository<User> = ds.getRepository(User);

  logger.title('Passo 3/4 — Usuários');
  logger.info(
    `Criando: 1 admin + ${Math.floor(USER_COUNT * 0.4)} managers + ${Math.ceil(USER_COUNT * 0.6)} externos`,
  );

  // Admin fixo
  await repo.upsert([repo.create(makeAdminUser())], {
    conflictPaths: ['ssoUserId'],
    skipUpdateIfNoValuesChanged: true,
  });

  // Managers (40%)
  const managers = Array.from({ length: Math.floor(USER_COUNT * 0.4) }, () =>
    makeManagerUser(),
  );

  // Externos (60%)
  const externals = Array.from({ length: Math.ceil(USER_COUNT * 0.6) }, () =>
    makeExternalUser(),
  );

  let success = 0;
  for (const user of [...managers, ...externals]) {
    try {
      await repo.upsert([repo.create(user)], {
        conflictPaths: ['ssoUserId'],
        skipUpdateIfNoValuesChanged: true,
      });
      logger.dim(`  ✔ ${user.firstName} ${user.lastName} <${user.email}>`);
      success++;
    } catch {
      logger.warn(`  Pulando duplicado: ${user.email}`);
    }
  }

  const users = await repo.find({ order: { id: 'ASC' } });
  logger.success(
    `${success + 1} usuário(s) inseridos. Total no banco: ${users.length}`,
  );
  return users;
}

async function stepAccessRequests(
  ds: DataSource,
  users: User[],
  companies: Company[],
  modules: Module[],
): Promise<void> {
  const arRepo: Repository<AccessRequest> = ds.getRepository(AccessRequest);
  const arItemRepo: Repository<AccessRequestItem> =
    ds.getRepository(AccessRequestItem);

  logger.title('Passo 4/4 — Access Requests');
  logger.info(
    `${REQUESTS_PER_USER} request(s) por usuário × ${users.length} usuários = ~${REQUESTS_PER_USER * users.length} requests`,
  );

  let totalRequests = 0;
  let totalItems = 0;

  for (const user of users) {
    const requests = makeAccessRequestsForUser(
      user,
      companies,
      modules,
      REQUESTS_PER_USER,
    );

    for (const requestData of requests) {
      const { items, ...requestFields } = requestData;

      const savedRequest = await arRepo.save(
        arRepo.create(requestFields as AccessRequest),
      );

      const itemEntities = items.map((item) =>
        arItemRepo.create({
          ...item,
          accessRequestId: savedRequest.id,
        } as AccessRequestItem),
      );
      await arItemRepo.save(itemEntities);

      logger.dim(
        `  User #${user.id} → Request #${savedRequest.id} [${savedRequest.overallStatus}] — ${items.length} item(s)`,
      );

      totalItems += items.length;
    }

    totalRequests += requests.length;
  }

  logger.success(
    `${totalRequests} access request(s) criados com ${totalItems} item(s).`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedFull(ds: DataSource): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════╗
║           SEED COMPLETO — MULTI TECH           ║
╠════════════════════════════════════════════════╣
║  Usuários:   ${String(USER_COUNT).padEnd(33)}║
║  Empresas:   ${String(COMPANY_COUNT).padEnd(33)}║
║  Requests/user: ${String(REQUESTS_PER_USER).padEnd(30)}║
╚════════════════════════════════════════════════╝
  `);

  const modules = await stepModules(ds);
  const companies = await stepCompanies(ds);
  const users = await stepUsers(ds);
  await stepAccessRequests(ds, users, companies, modules);

  logger.divider();
  logger.title('Resumo Final');
  logger.info(`Módulos:         ${modules.length}`);
  logger.info(`Empresas:        ${companies.length}`);
  logger.info(`Usuários:        ${users.length}`);
  logger.info(`Requests criados: ~${REQUESTS_PER_USER * users.length}`);
}

runSeed(seedDataSource, seedFull);
