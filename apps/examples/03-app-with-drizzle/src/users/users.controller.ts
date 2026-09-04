import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
} from 'nestjs-rest-query';
import { UsersService } from './users.service';
import { userRules } from './users.query';

/**
 * Forma do usuário **para o Swagger**, não para o runtime.
 *
 * A projeção real é decidida pelas regras e pela URL, e o adapter Drizzle
 * devolve `object`. Esta classe existe só para o schema OpenAPI ter um corpo
 * concreto; ela não participa da autorização nem da execução.
 */
class UserView {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  companyId: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ required: false, nullable: true })
  company?: { id: string; name: string } | null;

  @ApiProperty({ required: false, isArray: true })
  posts?: Array<{ id: string; title: string }>;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuários com filtros dinâmicos',
    description:
      'Filtros, ordenação, paginação, busca dobrada e relações, com whitelist exata por campo',
  })
  // As regras compiladas são a fonte única: o decorator as registra no handler
  // e gera a documentação a partir delas, então Swagger e autorização não podem
  // divergir.
  @ApiDynamicQuery(userRules)
  @ApiPaginatedResponse(UserView, {
    status: 200,
    description: 'Lista de usuários',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ) {
    return this.usersService.findAll(query, rules);
  }
}
