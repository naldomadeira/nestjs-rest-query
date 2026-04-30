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
 * User entity shape for Swagger documentation.
 * TODO(2.0.0): Replace with actual DTO once DrizzleAdapter is available.
 */
class UserDto {
  id: string;
  name: string;
  email: string;
  companyId?: string;
  createdAt: Date;
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
    filters: ['id', 'name', 'email', 'companyId', 'createdAt'],
    sorts: ['name', 'email', 'createdAt'],
    fields: ['id', 'name', 'email', 'companyId', 'createdAt'],
    includes: ['company', 'posts'],
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
