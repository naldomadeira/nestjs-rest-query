import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { AccessRequest } from '../access-requests/entities/access-request.entity';
import { AccessRequestItem } from '../access-requests/entities/access-request-item.entity';
import { Company } from '../companies/entities/company.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { User } from '../users/entities/user.entity';
import { MIGRATIONS } from './migrations.list';
config();

/**
 * DataSource do CLI de migrations.
 *
 * As entidades entram na lista porque a migration de seed grava as colunas
 * dobradas com o mesmo `foldText` que o listener das entidades usa; manter as
 * duas pontas no mesmo DataSource é o que impede a dobra de divergir entre o
 * que o seed grava e o que a aplicação grava depois.
 */
export const datasource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'multi_acessos',
  logging: process.env.LOG_LEVEL === 'debug',
  entities: [User, Company, ModuleEntity, AccessRequest, AccessRequestItem],
  migrations: MIGRATIONS,
});
