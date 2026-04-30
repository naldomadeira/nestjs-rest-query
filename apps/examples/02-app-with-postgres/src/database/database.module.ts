import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as path from 'path';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST'),
          port: config.get<number>('DB_PORT'),
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_NAME'),
          logging: config.get<string>('LOG_LEVEL') === 'debug',
          migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
          entities: [path.join(__dirname, '/../**/*.entity{.ts,.js}')],
          migrationsRun: true,
          ssl: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
