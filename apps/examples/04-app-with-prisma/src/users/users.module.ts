import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersBusiness } from './users.business';

@Module({
  controllers: [UsersController],
  providers: [UsersBusiness],
  exports: [UsersBusiness],
})
export class UsersModule {}
