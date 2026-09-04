import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  ApiPaginatedResponse,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
} from 'nestjs-rest-query';
import { PostsService } from './posts.service';
import { postRules } from './posts.query';

/** Forma do post para o Swagger — ver `UserView`. */
class PostView {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  content?: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ required: false })
  user?: { id: string; name: string };
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca posts com filtros dinâmicos',
    description:
      'Relação `one` não nulável para o autor, com projeção aninhada e busca dobrada',
  })
  @ApiDynamicQuery(postRules)
  @ApiPaginatedResponse(PostView, {
    status: 200,
    description: 'Lista de posts',
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules
  ) {
    return this.postsService.findAll(query, rules);
  }
}
