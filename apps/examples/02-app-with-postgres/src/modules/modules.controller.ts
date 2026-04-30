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
import { Module, Module as ModuleEntity } from './entities/module.entity';
import { ModulesBusiness } from './modules.business';

@ApiTags('modules')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesBusiness: ModulesBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca módulos com filtros dinâmicos',
    description:
      'Busca módulos com suporte a filtros, ordenação, paginação e seleção de campos',
  })
  @ApiDynamicQuery<Module>({
    filters: ['name', 'slug', 'status', 'createdAt', 'updatedAt'],
    sorts: ['name', 'slug', 'status', 'createdAt'],
    fields: ['id', 'name', 'slug', 'status', 'icon', 'createdAt', 'updatedAt'],
  })
  @ApiPaginatedResponse<Module>(ModuleEntity, {
    status: 200,
    description: 'Lista de módulos',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig,
  ): Promise<QueryResult<ModuleEntity>> {
    return this.modulesBusiness.findAll(query, rules);
  }
}
