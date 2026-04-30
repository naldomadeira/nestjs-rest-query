import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(
    query: DynamicQueryDto,
    rules: RulesConfig,
  ): Promise<QueryResult<Product>> {
    return this.queryBuilderService.execute(
      this.productRepository,
      query,
      rules,
    );
  }
}
