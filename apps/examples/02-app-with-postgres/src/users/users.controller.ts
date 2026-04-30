import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryResult,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';
import { User } from './entities/user.entity';
import { UsersBusiness } from './users.business';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersBusiness: UsersBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuários com filtros dinâmicos',
    description:
      'Busca usuários com suporte a filtros, ordenação, paginação e relacionamentos',
  })
  @ApiDynamicQuery<User>({
    filters: [
      'username',
      'email',
      'firstName',
      'lastName',
      'createdAt',
      'document',
      'ssoUserId',
      'id',
    ],
    sorts: ['username', 'email', 'createdAt'],
    fields: ['id', 'username', 'email', 'firstName', 'lastName', 'createdAt'],
  })
  @ApiPaginatedResponse<User>(User, {
    status: 200,
    description: 'Lista de usuários',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig,
  ): Promise<QueryResult<User>> {
    return this.usersBusiness.findAll(query, rules);
  }
}
