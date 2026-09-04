import { Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { prismaSource } from 'nestjs-rest-query/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { APP_MANIFEST } from '../query/manifest';

@Injectable()
export class PostsBusiness {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  /**
   * O serviço recebe uma *source discriminada*, não o client cru.
   *
   * É o que permite o mesmo núcleo atender TypeORM, Prisma e Drizzle sem que o
   * serviço saiba qual está em uso — e o adapter entra pelo subpath
   * `nestjs-rest-query/prisma`, porque o pacote raiz não carrega ORM nenhum
   * (a v2 exportava `PrismaAdapter` da raiz; a v3 não).
   *
   * O `model` é resolvido pelo manifesto, não por string livre: model fora do
   * manifesto ou delegate ausente do client falham antes de qualquer query.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<object>> {
    return this.queryBuilderService.execute(
      prismaSource({
        client: this.prisma,
        model: 'post',
        manifest: APP_MANIFEST,
      }),
      query,
      rules
    );
  }
}
