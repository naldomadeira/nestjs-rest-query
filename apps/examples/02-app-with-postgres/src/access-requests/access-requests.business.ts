import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { AccessRequest } from './entities/access-request.entity';

@Injectable()
export class AccessRequestsBusiness {
  constructor(
    @InjectRepository(AccessRequest)
    private readonly accessRequestRepository: Repository<AccessRequest>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(query: DynamicQueryDto, rules: RulesConfig): Promise<QueryResult<AccessRequest>> {
    return this.queryBuilderService.execute(this.accessRequestRepository, query, rules);
  }
}
