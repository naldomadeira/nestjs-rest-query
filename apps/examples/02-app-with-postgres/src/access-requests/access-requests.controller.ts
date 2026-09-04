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
import { AccessRequestsBusiness } from './access-requests.business';
import { AccessRequest } from './entities/access-request.entity';
import { accessRequestRules } from './access-requests.query';

@ApiTags('access-requests')
@Controller('access-requests')
export class AccessRequestsController {
  constructor(
    private readonly accessRequestsBusiness: AccessRequestsBusiness,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca solicitações de acesso com filtros dinâmicos',
    description:
      'Relação one (user), coleção many (items) e relações one dentro da coleção (items.company, items.module), com projeção aninhada',
  })
  @ApiDynamicQuery(accessRequestRules)
  @ApiPaginatedResponse(AccessRequest, {
    description: 'Lista de solicitações de acesso',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<AccessRequest>> {
    return this.accessRequestsBusiness.findAll(query, rules);
  }
}
