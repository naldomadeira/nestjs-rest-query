import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryResult,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';
import { PostsBusiness } from './posts.business';

class PostDto {
  id: string;
  title: string;
  content?: string;
  userId: string;
  createdAt: Date;
  user?: { id: string; name: string };
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsBusiness: PostsBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Fetch posts with dynamic filters',
    description:
      'Fetch posts with support for filters, sorting, pagination, and user includes',
  })
  @ApiDynamicQuery<PostDto>({
    filters: ['id', 'title', 'userId', 'createdAt', 'user'],
    sorts: ['title', 'createdAt', 'user'],
    fields: ['id', 'title', 'content', 'userId', 'createdAt'],
    includes: ['user'],
  })
  @ApiPaginatedResponse<PostDto>(PostDto, {
    status: 200,
    description: 'List of posts',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig
  ): Promise<QueryResult<PostDto>> {
    return this.postsBusiness.findAll(query, rules) as Promise<
      QueryResult<PostDto>
    >;
  }
}
