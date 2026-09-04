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
   * A whitelist de `search` daqui, porém, segue em `user.firstName`: os paths
   * da v2 cruzavam **duas** relações, e cadeia existencial de mais de um salto
   * é recusada pelo adapter TypeORM. Ver `access-requests.query.ts`.
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
