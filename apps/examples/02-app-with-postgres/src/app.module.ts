import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { CompaniesModule } from './companies/companies.module';
import { DatabaseModule } from './database/database.module';
import { ModulesModule } from './modules/modules.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DynamicQueryBuilderModule.forRoot({
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 100,
      },
    }),
    DatabaseModule,
    UsersModule,
    CompaniesModule,
    AccessRequestsModule,
    ModulesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
