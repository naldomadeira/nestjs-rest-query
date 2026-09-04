import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  type CompiledQueryRules,
  type NormalizedQueryResult,
} from 'nestjs-rest-query';
import { typeormSource } from 'nestjs-rest-query/typeorm';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  /**
   * O serviço recebe uma *source discriminada*, não o repositório cru.
   *
   * É o que permite o mesmo núcleo atender TypeORM, Prisma e Drizzle sem que o
   * serviço saiba qual está em uso — e o adapter entra pelo subpath
   * `nestjs-rest-query/typeorm`, porque o pacote raiz não carrega ORM nenhum.
   */
  async findAll(
    query: DynamicQueryDto,
    rules: CompiledQueryRules,
  ): Promise<NormalizedQueryResult<Product>> {
    return this.queryBuilderService.execute(
      typeormSource(this.productRepository),
      query,
      rules,
    );
  }
}
