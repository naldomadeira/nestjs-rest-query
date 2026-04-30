import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersBusiness } from './users.business';
import { drizzleProvider } from '@app/db/drizzle.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersBusiness, drizzleProvider],
  exports: [UsersBusiness],
})
export class UsersModule {}
