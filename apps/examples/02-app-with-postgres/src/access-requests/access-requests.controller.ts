import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  DynamicQueryDto,
  QueryResult,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';
import { AccessRequestsBusiness } from './access-requests.business';
import { AccessRequest } from './entities/access-request.entity';

@ApiTags('access-requests')
@Controller('access-requests')
export class AccessRequestsController {
  constructor(
    private readonly accessRequestsBusiness: AccessRequestsBusiness,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca solicitações de acesso com filtros dinâmicos',
  })
  @ApiDynamicQuery<AccessRequest>({
    filters: [
      'userId',
      'overallStatus',
      'createdAt',
      'deletedAt',
      'user',
      'items',
      'items.company',
      'items.module',
      'user.firstName',
    ],
    sorts: ['userId', 'overallStatus', 'createdAt', 'user.firstName'],
    fields: [
      'id',
      'userId',
      'overallStatus',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'items',
      'user',
    ],
    includes: ['user', 'items', 'items.company', 'items.module'],
    search: [
      'user.firstName',
      'user.document',
      'items.company.name',
      'items.company.cnpj',
    ],
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de solicitações retornada com sucesso',
    type: [AccessRequest],
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig,
  ): Promise<QueryResult<AccessRequest>> {
    return this.accessRequestsBusiness.findAll(query, rules);
  }
}
