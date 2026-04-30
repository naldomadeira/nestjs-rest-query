import { Controller, Get, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Product } from './entities/product.entity';
import {
  ApiDynamicQuery,
  DynamicQueryDto,
  QueryRules,
  RulesConfig,
} from 'nestjs-rest-query';

@Controller('products')
@ApiTags('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca produtos com filtros dinâmicos',
    description:
      'Busca produtos com suporte a filtros, ordenação, paginação e relacionamentos',
  })
  @ApiDynamicQuery({
    filters: ['id', 'price', 'name', 'category', 'categoryId'],
    fields: ['id', 'price', 'name', 'category', 'createdAt'],
    sorts: ['id', 'price', 'name', 'createdAt'],
    includes: ['category'],
  })
  @ApiOkResponse({
    type: Product,
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig,
  ) {
    return this.productService.findAll(query, rules);
  }
}
