import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { DRIZZLE_INSTANCE } from '@app/db/drizzle.provider';
import { companies, users } from '@app/db/schema';

@Injectable()
export class CompaniesBusiness {
  constructor(
    @Inject(DRIZZLE_INSTANCE)
    private readonly db: any,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  async findAll(
    query: DynamicQueryDto,
    rules: RulesConfig
  ): Promise<QueryResult<any>> {
    const source = {
      db: this.db,
      table: companies,
      primaryKey: companies.id,
      relations: {
        users: {
          table: users,
          on: eq(users.companyId, companies.id),
          cardinality: 'many' as const,
          primaryKey: users.id,
        },
      },
    };
    return this.queryBuilderService.execute(source as any, query, rules);
  }
}
