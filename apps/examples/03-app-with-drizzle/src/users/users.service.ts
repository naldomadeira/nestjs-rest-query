import { Inject, Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { drizzleSource, type DrizzleDatabase } from 'nestjs-rest-query/drizzle';
import { DRIZZLE_EXECUTOR } from '../db/database.module';
import { userRelations, usersTable } from '../db/tables';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_EXECUTOR)
    private readonly db: DrizzleDatabase,
    private readonly queryBuilderService: QueryBuilderService
  ) {}

  /**
   * O serviço monta uma *source discriminada*, não uma query.
   *
   * `drizzleSource` carrega tudo que o núcleo precisa para decidir: o dialeto,
   * a tabela, as relações por path pontuado e o schema lógico derivado delas.
   * O mesmo `QueryBuilderService` atende TypeORM, Prisma e Drizzle sem saber
   * qual está em uso — e o adapter entra pelo subpath
   * `nestjs-rest-query/drizzle`, porque o pacote raiz não carrega ORM nenhum.
   *
   * O `dialect` declarado aqui precisa ser o mesmo do executor. Divergir não
   * daria erro em lugar nenhum — daria resultado errado, porque paginação e
   * coerção de boolean saem do dialeto —, então `drizzleSource` compara os dois
   * e falha fechado.
   *
   * `NormalizedQueryResult<object>` não é preguiça: `drizzleSource` fixa o tipo
   * da linha em `object` (só `typeormSource` é genérico no row), e apertar isso
   * aqui exigiria um cast — que o gate de "nenhum cast no uso documentado"
   * proíbe.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<object>> {
    return this.queryBuilderService.execute(
      drizzleSource({
        db: this.db,
        dialect: 'postgres',
        table: usersTable,
        relations: userRelations,
      }),
      query,
      rules
    );
  }
}
