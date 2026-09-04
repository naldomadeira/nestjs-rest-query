import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDynamicQuery,
  DynamicQueryDto,
  QueryRules,
  type CompiledQueryRules,
} from 'nestjs-rest-query';
import { ProductService } from './product.service';
import { productRules } from './product.query';
import { Product } from './entities/product.entity';

@Controller('products')
@ApiTags('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca produtos com filtros dinâmicos',
    description:
      'Filtros, ordenação, paginação e relações, com whitelist exata por campo',
  })
  // As regras compiladas são a fonte única: o decorator as registra no handler
  // e gera a documentação a partir delas, então Swagger e autorização não
  // podem divergir.
  @ApiDynamicQuery(productRules)
  @ApiOkResponse({ type: Product })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: CompiledQueryRules,
  ) {
    return this.productService.findAll(query, rules);
  }
}
