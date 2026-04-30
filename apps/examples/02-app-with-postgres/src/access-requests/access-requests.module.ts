import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessRequestsBusiness } from './access-requests.business';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequest } from './entities/access-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccessRequest])],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsBusiness],
  exports: [AccessRequestsBusiness],
})
export class AccessRequestsModule {}
