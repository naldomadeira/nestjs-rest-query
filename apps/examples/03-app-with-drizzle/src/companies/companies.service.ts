import { Inject, Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { drizzleSource, type DrizzleDatabase } from 'nestjs-rest-query/drizzle';
import { DRIZZLE_EXECUTOR } from '../db/database.module';
import type { CompanyRow } from '../db/rows';
import { companiesTable, companyRelations } from '../db/tables';

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(DRIZZLE_EXECUTOR)
    private readonly db: DrizzleDatabase<CompanyRow>,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  /** Ver `UsersService.findAll` para o porquê da source e do tipo da linha. */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<CompanyRow>> {
    return this.queryBuilderService.execute(
      drizzleSource({
        db: this.db,
        dialect: 'postgres',
        table: companiesTable,
        relations: companyRelations,
      }),
      query,
      rules
    );
  }
}
