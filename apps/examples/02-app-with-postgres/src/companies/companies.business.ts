import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { typeormSource } from 'nestjs-rest-query/typeorm';
import { Company } from './entities/company.entity';

@Injectable()
export class CompaniesBusiness {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  /**
   * A v2 desta classe passava um `customize` que montava
   * `(name ILIKE :s OR cnpj ILIKE :s)` a partir de um `search` que a própria
   * aplicação inventava numa DTO estendida. Nada disso sobreviveu, e é o
   * exemplo mais direto do que a v3 muda:
   *
   * - `search` é da gramática, declarado campo a campo nas regras, e compila
   *   sobre a coluna dobrada — o mesmo conjunto em PostgreSQL, MySQL e SQL
   *   Server.
   * - `ILIKE` escrito à mão faz o resultado depender da collation do servidor,
   *   que é exatamente o que o perfil `portable-strict` existe para eliminar.
   * - O `customize` continua disponível para o que é de fato específico do
   *   adapter (tenant, política interna), e aí declara escopo: `both` por
   *   default, para o count nunca descrever uma pergunta diferente da dos
   *   dados. Filtrar texto não é esse caso.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<Company>> {
    return this.queryBuilderService.execute(
      typeormSource(this.companyRepository),
      query,
      rules,
    );
  }
}
