import { Injectable, Inject } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { DRIZZLE_INSTANCE } from '@app/db/drizzle.provider';

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
    // TODO(2.0.0): Wire in once DrizzleAdapter is published.
    // For now, return a stub response structure.
    // Expected usage:
    // const source = {
    //   db: this.db,
    //   table: this.db.schema.users,
    //   primaryKey: 'id',
    //   relations: this.db.schema.usersRelations,
    //   columnMap: { /* field remapping if needed */ },
    // };
    // return this.queryBuilderService.execute(source, query, rules);

    return {
      data: [],
      page: 1,
      perPage: 10,
      total: 0,
      lastPage: 1,
    };
  }
}
