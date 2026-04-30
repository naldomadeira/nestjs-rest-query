import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module as ModuleEntity } from './entities/module.entity';
import { ModulesBusiness } from './modules.business';
import { ModulesController } from './modules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleEntity])],
  controllers: [ModulesController],
  providers: [ModulesBusiness],
  exports: [ModulesBusiness],
})
export class ModulesModule {}
