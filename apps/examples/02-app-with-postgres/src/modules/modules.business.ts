import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { Module as ModuleEntity } from './entities/module.entity';

@Injectable()
export class ModulesBusiness {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(
    query: DynamicQueryDto,
    rules: RulesConfig,
  ): Promise<QueryResult<ModuleEntity>> {
    return this.queryBuilderService.execute(
      this.moduleRepository,
      query,
      rules,
    );
  }
}
