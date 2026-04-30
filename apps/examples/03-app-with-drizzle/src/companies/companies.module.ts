import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesBusiness } from './companies.business';
import { drizzleProvider } from '@app/db/drizzle.provider';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesBusiness, drizzleProvider],
  exports: [CompaniesBusiness],
})
export class CompaniesModule {}
