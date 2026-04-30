import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { Company } from './entities/company.entity';
import { CompanyQueryDto } from './dtos/company-query.dto';

@Injectable()
export class CompaniesBusiness {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(
    query: CompanyQueryDto,
    rules: RulesConfig,
  ): Promise<QueryResult<Company>> {
    // Find all com empresas e um filtro de busca customizado
    return this.queryBuilderService.execute(
      this.companyRepository,
      query,
      rules,
      (qb) => {
        if (query.search?.trim()) {
          const alias = rules.alias ?? 'root';
          qb.andWhere(
            `(${alias}.name ILIKE :search OR ${alias}.cnpj ILIKE :search)`,
            { search: `%${query.search.trim()}%` },
          );
        }
      },
    );
  }
}
