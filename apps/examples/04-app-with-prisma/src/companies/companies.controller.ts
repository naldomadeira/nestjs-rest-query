import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { CompaniesBusiness } from './companies.business';
import { companiesRules } from './companies.query';

class CompanyDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ required: false })
  users?: Array<{ id: number; name: string }>;
}

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesBusiness: CompaniesBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca empresas com filtros dinâmicos',
    description: 'Filtros, ordenação, paginação e a coleção de usuários',
  })
  @ApiDynamicQuery(companiesRules)
  @ApiPaginatedResponse(CompanyDto, {
    status: 200,
    description: 'Lista de empresas',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<object>> {
    return this.companiesBusiness.findAll(query, rules);
  }
}
