import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
} from 'nestjs-rest-query';
import { CompaniesService } from './companies.service';
import { companyRules } from './companies.query';

/** Forma da empresa para o Swagger — ver `UserView`. */
class CompanyView {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ required: false, isArray: true })
  users?: Array<{ id: string; name: string }>;
}

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca empresas com filtros dinâmicos',
    description:
      'Inclui a coleção de usuários, hidratada por consulta própria para não inflar a paginação',
  })
  @ApiDynamicQuery(companyRules)
  @ApiPaginatedResponse(CompanyView, {
    status: 200,
    description: 'Lista de empresas',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ) {
    return this.companiesService.findAll(query, rules);
  }
}
