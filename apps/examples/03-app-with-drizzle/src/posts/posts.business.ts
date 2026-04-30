import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { DRIZZLE_INSTANCE } from '@app/db/drizzle.provider';
import { posts, users } from '@app/db/schema';

@Injectable()
export class PostsBusiness {
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
      table: posts,
      primaryKey: posts.id,
      relations: {
        user: {
          table: users,
          on: eq(posts.userId, users.id),
        },
      },
    };
    return this.queryBuilderService.execute(source as any, query, rules);
  }
}
