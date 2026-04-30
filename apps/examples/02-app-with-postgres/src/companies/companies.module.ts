import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesBusiness } from './companies.business';
import { CompaniesController } from './companies.controller';
import { Company } from './entities/company.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  controllers: [CompaniesController],
  providers: [CompaniesBusiness],
  exports: [CompaniesBusiness],
})
export class CompaniesModule {}
