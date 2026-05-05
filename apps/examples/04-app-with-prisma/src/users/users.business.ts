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
export class UsersBusiness {
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
      model: 'user',
      primaryKeyField: 'id',
      relations: {
        company: { cardinality: 'one' },
        posts: { cardinality: 'many' },
      },
    };
    // `as never`: QueryBuilderService is generically constrained to ObjectLiteral
    // (TypeORM) at the type level. Runtime is adapter-agnostic; the cast is a
    // typing escape hatch until the typing rework lands.
    return this.queryBuilderService.execute(source as never, query, rules);
  }
}
