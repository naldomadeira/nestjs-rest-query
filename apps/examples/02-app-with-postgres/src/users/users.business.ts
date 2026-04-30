import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DynamicQueryDto,
  QueryBuilderService,
  QueryResult,
  RulesConfig,
} from 'nestjs-rest-query';
import { User } from './entities/user.entity';

@Injectable()
export class UsersBusiness {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queryBuilderService: QueryBuilderService,
  ) {}

  async findAll(query: DynamicQueryDto, rules: RulesConfig): Promise<QueryResult<User>> {
    return this.queryBuilderService.execute(this.userRepository, query, rules);
  }
}
