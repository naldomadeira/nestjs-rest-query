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
import { PostsBusiness } from './posts.business';
import type { PostRow } from '../query/rows';
import { postsRules } from './posts.query';

class PostDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true, type: String })
  content: string | null;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ required: false })
  user?: { id: number; name: string };
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsBusiness: PostsBusiness) {}

  @Get()
  @ApiOperation({
    summary: 'Busca posts com filtros dinâmicos',
    description: 'Filtros, ordenação, paginação e o autor incluído',
  })
  @ApiDynamicQuery(postsRules)
  @ApiPaginatedResponse(PostDto, { status: 200, description: 'Lista de posts' })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ): Promise<NormalizedQueryResult<PostRow>> {
    return this.postsBusiness.findAll(query, rules);
  }
}
