import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { DRIZZLE_INSTANCE } from '@app/db/drizzle.provider';
import { companies, posts, users } from '@app/db/schema';

@Injectable()
export class UsersBusiness {
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
      table: users,
      primaryKey: users.id,
      relations: {
        company: {
          table: companies,
          on: eq(users.companyId, companies.id),
        },
        posts: {
          table: posts,
          on: eq(posts.userId, users.id),
          cardinality: 'many' as const,
          primaryKey: posts.id,
        },
      },
    };
    return this.queryBuilderService.execute(source as any, query, rules);
  }
}
