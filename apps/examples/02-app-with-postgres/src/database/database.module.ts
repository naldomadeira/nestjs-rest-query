import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessRequest } from '../access-requests/entities/access-request.entity';
import { AccessRequestItem } from '../access-requests/entities/access-request-item.entity';
import { Company } from '../companies/entities/company.entity';
import { Module as ModuleEntity } from '../modules/entities/module.entity';
import { User } from '../users/entities/user.entity';
import { MIGRATIONS } from './migrations.list';

/**
 * Entidades e migrations são listadas, não descobertas por glob.
 *
 * O glob antigo (`path.join(__dirname, ...)`) depende de `__dirname`, que não
 * existe em ESM — e o smoke E2E roda em ESM porque `@nestjs/typeorm@12` é um
 * pacote ESM puro. Listar tem um segundo efeito, melhor: uma entidade renomeada
 * passa a quebrar o build, e não a inicialização.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        // Defaults iguais ao `docker-compose.yml` deste exemplo: sem eles a
        // aplicação só sobe com um `.env` que o repositório não versiona, e o
        // erro aparece como "password authentication failed", não como
        // configuração faltando.
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: Number(config.get<string>('DB_PORT') ?? 5432),
        username: config.get<string>('DB_USERNAME') ?? 'postgres',
        password: config.get<string>('DB_PASSWORD') ?? 'postgres',
        database: config.get<string>('DB_NAME') ?? 'multi_acessos',
        logging: config.get<string>('LOG_LEVEL') === 'debug',
        entities: [
          User,
          Company,
          ModuleEntity,
          AccessRequest,
          AccessRequestItem,
        ],
        migrations: MIGRATIONS,
        // `synchronize` fica desligado de propósito: as colunas dobradas e os
        // índices sobre elas vivem nas migrations, e é delas que o schema real
        // tem de sair — o adapter compara o schema declarado com a metadata,
        // não com o que o banco por acaso tem.
        migrationsRun: true,
        ssl: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
