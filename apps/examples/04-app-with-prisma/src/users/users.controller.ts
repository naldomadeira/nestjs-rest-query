import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { UsersBusiness } from './users.business';
import type { UserRow } from '../query/rows';
import { usersRules } from './users.query';

/**
 * Shape documentado do usuário.
 *
 * Só campos visíveis: as colunas dobradas (`nameFolded`, `emailFolded`) são
 * internas e nunca saem no JSON, mesmo quando o campo que elas apoiam é
 * projetado.
 */
class UserDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, type: Number })
  companyId: number | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({
    required: false,
    description: 'Relação `one`: objeto ou null',
  })
  company?: { id: number; name: string } | null;

  @ApiProperty({
    required: false,
    description: 'Relação `many`: array, possivelmente vazio',
  })
  posts?: Array<{ id: string; title: string }>;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersBusiness: UsersBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuários com filtros dinâmicos',
    description:
      'Filtros, ordenação, paginação e relações, com whitelist exata por campo',
  })
  // As regras compiladas são a fonte única: o decorator as registra no handler
  // e gera a documentação a partir delas.
  @ApiDynamicQuery(usersRules)
  @ApiPaginatedResponse(UserDto, {
    status: 200,
    description: 'Lista de usuários',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<UserRow>> {
    return this.usersBusiness.findAll(query, rules);
  }
}
