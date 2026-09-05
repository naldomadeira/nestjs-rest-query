import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { CompaniesBusiness } from './companies.business';
import { Company } from './entities/company.entity';
import { companyRules } from './companies.query';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesBusiness: CompaniesBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca empresas com filtros dinâmicos',
    description:
      'A busca por razão social usa a coluna dobrada; parcial de CNPJ usa filter[cnpj][like], onde % e _ são literais',
  })
  // A DTO estendida da v2 (`CompanyQueryDto`, com um `search` próprio) foi
  // removida: `search` é parâmetro da gramática e já vem em `DynamicQueryDto`.
  @ApiDynamicQuery(companyRules)
  @ApiPaginatedResponse(Company, { description: 'Lista de empresas' })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<Company>> {
    return this.companiesBusiness.findAll(query, rules);
  }
}
