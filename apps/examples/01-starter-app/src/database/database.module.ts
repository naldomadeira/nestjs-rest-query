import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Category } from '../product/entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { SeedProductsAndCategory1756384597273 } from './migrations/1756384597273-SeedProductsAndCategory';

/**
 * Entidades e migrations são listadas explicitamente, não descobertas por glob.
 *
 * Glob depende de `__dirname`, que não existe em ESM — e o smoke E2E roda em
 * ESM porque `@nestjs/typeorm@12` é um pacote ESM puro. Listar é também o que
 * faz a falha ser de compilação: uma entidade renomeada quebra o build, não a
 * inicialização.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // O TypeORM 1.x removeu o driver `sqlite` em favor de `better-sqlite3`.
        type: 'better-sqlite3',
        database:
          configService.get<string>('DATABASE_PATH') ?? 'database.sqlite',
        entities: [Product, Category],
        migrations: [SeedProductsAndCategory1756384597273],
        logging: configService.get<string>('LOG_LEVEL') === 'debug',
        synchronize: true, // for demo/development
        // No TypeORM 1.x `migrationsRun` acontece *antes* de `synchronize`, de
        // modo que a migration de seed não pode contar com o schema criado
        // pela sincronização. Quem prepara o banco é o script de migrations
        // (`pnpm migrations:run`) — ou, no smoke E2E, o próprio `beforeAll`.
        migrationsRun: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
