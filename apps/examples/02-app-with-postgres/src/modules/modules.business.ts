import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { typeormSource } from 'nestjs-rest-query/typeorm';
import { Module as ModuleEntity } from './entities/module.entity';

@Injectable()
export class ModulesBusiness {
  constructor(
    @InjectRepository(ModuleEntity)
    private readonly moduleRepository: Repository<ModuleEntity>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  /** Ver `users.business.ts` para o porquê da source discriminada. */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<ModuleEntity>> {
    return this.queryBuilderService.execute(
      typeormSource(this.moduleRepository),
      query,
      rules,
    );
  }
}
