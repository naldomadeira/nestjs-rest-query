import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  QueryResult,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';
import { CompaniesBusiness } from './companies.business';
import { Company } from './entities/company.entity';
import { CompanyQueryDto } from './dtos/company-query.dto';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesBusiness: CompaniesBusiness) {}

  @Get()
  @ApiOperation({ summary: 'Busca empresas com filtros dinâmicos' })
  @ApiDynamicQuery<Company>({
    filters: ['name', 'cnpj', 'createdAt', 'updatedAt'],
    sorts: ['name', 'cnpj', 'createdAt'],
    fields: ['id', 'uuid', 'cnpj', 'name', 'createdAt', 'updatedAt'],
  })
  @ApiPaginatedResponse<Company>(Company, {
    status: 200,
    description: 'Lista de empresas',
  })
  async findAll(
    @Query() query: CompanyQueryDto,
    @QueryRules() rules: RulesConfig,
  ): Promise<QueryResult<Company>> {
    return this.companiesBusiness.findAll(query, rules);
  }
}
