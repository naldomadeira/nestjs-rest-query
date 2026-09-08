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
import { User } from './entities/user.entity';

@Injectable()
export class UsersBusiness {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  /**
   * `execute` recebe uma *source discriminada*, não o repositório solto.
   *
   * É o que permite o mesmo núcleo semântico atender TypeORM, Prisma e Drizzle
   * sem que esta classe saiba qual está em uso — e o adapter entra pelo subpath
   * `nestjs-rest-query/typeorm`, porque a raiz do pacote não carrega ORM
   * nenhum.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<User>> {
    return this.queryBuilderService.execute(
      typeormSource(this.userRepository),
      query,
      rules,
    );
  }
}
