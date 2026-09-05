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
import { AccessRequest } from './entities/access-request.entity';

@Injectable()
export class AccessRequestsBusiness {
  constructor(
    @InjectRepository(AccessRequest)
    private readonly accessRequestRepository: Repository<AccessRequest>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  /**
   * Ver `users.business.ts` para o porquê da source discriminada.
   *
   * Este endpoint foi quem encontrou o bug de página curta do `search` por
   * relação `many` — medido aqui, contra este Postgres, com 24 solicitações e
   * 36 itens: `perPage=5` voltava com 4 linhas. A `3.0.0` corrigiu, e o caso
   * `search/through-many-is-existential` do corpus trava a correção nos três
   * adapters.
   *
   * A whitelist voltou a ter `items.company.name`, que cruza duas relações —
   * a coleção e depois a empresa. Isso era recusado pelo adapter TypeORM até a
   * `3.0.0`, e hoje compila como um único `EXISTS` correlacionado ao root uma
   * só vez, com o segundo salto por join dentro da subconsulta.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<AccessRequest>> {
    return this.queryBuilderService.execute(
      typeormSource(this.accessRequestRepository),
      query,
      rules,
    );
  }
}
