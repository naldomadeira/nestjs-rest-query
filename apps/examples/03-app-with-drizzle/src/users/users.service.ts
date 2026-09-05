import { Inject, Injectable } from '@nestjs/common';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { drizzleSource, type DrizzleDatabase } from 'nestjs-rest-query/drizzle';
import { DRIZZLE_EXECUTOR } from '../db/database.module';
import type { UserRow } from '../db/rows';
import { userRelations, usersTable } from '../db/tables';

@Injectable()
export class UsersService {
  constructor(
    /**
     * O executor é quem promete a forma da linha.
     *
     * O provider devolve um `DrizzleDatabase` sem tipo de linha, porque ele
     * serve a todas as tabelas; cada serviço declara aqui o que a *sua*
     * consulta devolve, e `drizzleSource` propaga isso até `execute()`. É a
     * mesma divisão do `Repository<T>` do TypeORM — a promessa fica no ponto
     * onde as linhas nascem, não num cast no fim.
     */
    @Inject(DRIZZLE_EXECUTOR)
    private readonly db: DrizzleDatabase<UserRow>,
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
   * `UserRow` chega ao retorno por inferência, sem argumento de tipo e sem
   * cast: ele vem do executor injetado. Até o PR5 isto era
   * `NormalizedQueryResult<object>`, porque `drizzleSource` fixava a linha em
   * `object` e só `typeormSource` era genérico.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<UserRow>> {
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
