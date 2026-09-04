/**
 * Seed: Access Requests
 *
 * Cria access requests com items para usuários existentes.
 * Requer que users, companies e modules já existam no banco.
 * Execute antes: yarn seed:modules && yarn seed:companies && yarn seed:users
 *
 * Uso:
 *   yarn seed:access-requests              → 2 requests por usuário
 *   yarn seed:access-requests --count 5    → 5 requests por usuário
 *
 * Variações geradas:
 *   - pending   : aguardando avaliação
 *   - approved  : totalmente aprovado
 *   - rejected  : totalmente rejeitado
 *   - partial   : itens com statuses misturados
 */
import { Repository } from 'typeorm';
import { AccessRequestItem } from '../../access-requests/entities/access-request-item.entity';
import { AccessRequest } from '../../access-requests/entities/access-request.entity';
import { Company } from '../../companies/entities/company.entity';
import { Module } from '../../modules/entities/module.entity';
import { User } from '../../users/entities/user.entity';
import { makeAccessRequestsForUser } from './factories/access-request.factory';
import { seedDataSource } from './seed.datasource';
import { logger, parseCount, runSeed } from './utils/seed.helpers';

async function seedAccessRequests(ds: typeof seedDataSource): Promise<void> {
  const userRepo: Repository<User> = ds.getRepository(User);
  const companyRepo: Repository<Company> = ds.getRepository(Company);
  const moduleRepo: Repository<Module> = ds.getRepository(Module);
  const arRepo: Repository<AccessRequest> = ds.getRepository(AccessRequest);
  const arItemRepo: Repository<AccessRequestItem> =
    ds.getRepository(AccessRequestItem);

  logger.title('Seeding Access Requests');

  // Carregar dados existentes
  const users = await userRepo.find();
  const companies = await companyRepo.find();
  const modules = await moduleRepo.find();

  if (users.length === 0) {
    logger.error('Nenhum usuário encontrado. Execute seed:users primeiro.');
    process.exit(1);
  }
  if (companies.length === 0) {
    logger.error(
      'Nenhuma empresa encontrada. Execute seed:companies primeiro.',
    );
    process.exit(1);
  }
  if (modules.length === 0) {
    logger.error('Nenhum módulo encontrado. Execute seed:modules primeiro.');
    process.exit(1);
  }

  const requestsPerUser = parseCount(2);

  logger.info(`Usuários: ${users.length}`);
  logger.info(`Empresas: ${companies.length}`);
  logger.info(`Módulos: ${modules.length}`);
  logger.info(`Requests por usuário: ${requestsPerUser}`);
  logger.divider();

  let totalRequests = 0;
  let totalItems = 0;

  for (const user of users) {
    const requests = makeAccessRequestsForUser(
      user,
      companies,
      modules,
      requestsPerUser,
    );

    for (const requestData of requests) {
      const { items, ...requestFields } = requestData;

      // Salva o access request
      const savedRequest = await arRepo.save(
        arRepo.create(requestFields as AccessRequest),
      );

      // Salva os items vinculados
      const itemEntities = items.map((item) =>
        arItemRepo.create({
          ...item,
          accessRequestId: savedRequest.id,
        } as AccessRequestItem),
      );
      await arItemRepo.save(itemEntities);

      totalItems += items.length;
      logger.dim(
        `User #${user.id} (${user.firstName}) → Request #${savedRequest.id} [${savedRequest.overallStatus}] com ${items.length} item(s)`,
      );
    }

    totalRequests += requests.length;
  }

  logger.divider();
  logger.success(
    `${totalRequests} access request(s) criados com ${totalItems} item(s) no total.`,
  );
}

runSeed(seedDataSource, seedAccessRequests);
