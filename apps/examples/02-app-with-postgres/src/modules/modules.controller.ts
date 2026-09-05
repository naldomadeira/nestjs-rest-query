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
import { Module as ModuleEntity } from './entities/module.entity';
import { ModulesBusiness } from './modules.business';
import { moduleRules } from './modules.query';

@ApiTags('modules')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesBusiness: ModulesBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca módulos com filtros dinâmicos',
    description:
      'O status é enum: valor fora do conjunto declarado é recusado antes de chegar ao banco',
  })
  @ApiDynamicQuery(moduleRules)
  @ApiPaginatedResponse(ModuleEntity, { description: 'Lista de módulos' })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<ModuleEntity>> {
    return this.modulesBusiness.findAll(query, rules);
  }
}
