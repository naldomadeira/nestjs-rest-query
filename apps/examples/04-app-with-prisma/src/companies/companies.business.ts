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
export class CompaniesBusiness {
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
      model: 'company',
      primaryKeyField: 'id',
      relations: {
        users: { cardinality: 'many' },
      },
    };
    return this.queryBuilderService.execute(source as never, query, rules);
  }
}
