import { Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  PrismaSource,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { PrismaService } from '@app/prisma/prisma.service';

@Injectable()
export class PostsBusiness {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  async findAll(
    query: DynamicQueryDto,
    rules: RulesConfig
  ): Promise<QueryResult<unknown>> {
    const source: PrismaSource = {
      prisma: this.prisma,
      model: 'post',
      primaryKeyField: 'id',
      relations: {
        user: { cardinality: 'one' },
      },
    };
    return this.queryBuilderService.execute(source as never, query, rules);
  }
}
