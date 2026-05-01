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
import { UsersBusiness } from './users.business';

/**
 * User entity shape for Swagger documentation. Relation slots reflect
 * the table-grouped shape produced by `DrizzleAdapter` so the
 * generic-typed `RulesConfig<UserDto>` accepts include keys.
 */
class UserDto {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  createdAt: Date;
  company?: { id: string; name: string };
  posts?: Array<{ id: string; title: string }>;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersBusiness: UsersBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Fetch users with dynamic filters',
    description:
      'Fetch users with support for filters, sorting, pagination, and relationships',
  })
  @ApiDynamicQuery<UserDto>({
    filters: [
      'id',
      'name',
      'email',
      'companyId',
      'createdAt',
      'company',
      'posts',
    ],
    // sort on 'posts' is intentionally NOT allowed: ORDER BY through a 'many'
    // relation is rejected by the adapter (semantic ambiguity under DISTINCT).
    sorts: ['name', 'email', 'createdAt', 'company'],
    fields: ['id', 'name', 'email', 'companyId', 'createdAt'],
    includes: ['company', 'posts'],
    search: ['name', 'email', 'company.name'],
  })
  @ApiPaginatedResponse<UserDto>(UserDto, {
    status: 200,
    description: 'List of users',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig
  ): Promise<QueryResult<UserDto>> {
    return this.usersBusiness.findAll(query, rules);
  }
}
