import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesBusiness } from './companies.business';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesBusiness],
  exports: [CompaniesBusiness],
})
export class CompaniesModule {}
