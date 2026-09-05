import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { User } from './entities/user.entity';
import { UsersBusiness } from './users.business';
import { userRules } from './users.query';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersBusiness: UsersBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuários com filtros dinâmicos',
    description:
      'Filtros, ordenação, paginação e busca dobrada, com whitelist exata por campo e operador',
  })
  // As regras compiladas são a fonte única: o decorator as registra no handler
  // (é delas que `@QueryRules()` vem) e monta a documentação a partir do mesmo
  // objeto. Swagger e autorização não podem divergir porque não são duas
  // declarações.
  @ApiDynamicQuery(userRules)
  @ApiPaginatedResponse(User, { description: 'Lista de usuários' })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<User>> {
    return this.usersBusiness.findAll(query, rules);
  }
}
