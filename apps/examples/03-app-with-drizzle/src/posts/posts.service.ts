import { Inject, Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { drizzleSource, type DrizzleDatabase } from 'nestjs-rest-query/drizzle';
import { DRIZZLE_EXECUTOR } from '../db/database.module';
import type { PostRow } from '../db/rows';
import { postRelations, postsTable } from '../db/tables';

@Injectable()
export class PostsService {
  constructor(
    @Inject(DRIZZLE_EXECUTOR)
    private readonly db: DrizzleDatabase<PostRow>,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  /** Ver `UsersService.findAll` para o porquê da source e do tipo da linha. */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<PostRow>> {
    return this.queryBuilderService.execute(
      drizzleSource({
        db: this.db,
        dialect: 'postgres',
        table: postsTable,
        relations: postRelations,
      }),
      query,
      rules
    );
  }
}
