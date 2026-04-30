import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryResult,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';
import { CompaniesBusiness } from './companies.business';

/**
 * Company entity shape for Swagger documentation. Relation slot
 * reflects the table-grouped shape produced by `DrizzleAdapter`.
 */
class CompanyDto {
  id: string;
  name: string;
  createdAt: Date;
  users?: Array<{ id: string; name: string }>;
}

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesBusiness: CompaniesBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Fetch companies with dynamic filters',
    description:
      'Fetch companies with support for filters, sorting, and pagination',
  })
  @ApiDynamicQuery<CompanyDto>({
    filters: ['id', 'name', 'createdAt'],
    sorts: ['name', 'createdAt'],
    fields: ['id', 'name', 'createdAt'],
    includes: ['users'],
  })
  @ApiPaginatedResponse<CompanyDto>(CompanyDto, {
    status: 200,
    description: 'List of companies',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig
  ): Promise<QueryResult<CompanyDto>> {
    return this.companiesBusiness.findAll(query, rules);
  }
}
