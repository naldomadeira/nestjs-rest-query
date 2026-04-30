import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        return {
          type: 'sqlite',
          database: 'database.sqlite',
          entities: [path.resolve(__dirname, '../**/*.entity{.ts,.js}')],
          migrations: [`${__dirname}/migrations/*{.ts,.js}`],
          logging: configService.get<string>('LOG_LEVEL') === 'debug',
          synchronize: true, // for demo/development
          migrationsRun: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
