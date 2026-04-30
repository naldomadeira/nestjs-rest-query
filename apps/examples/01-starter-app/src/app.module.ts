import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DynamicQueryBuilderModule.forRoot({
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 100,
      },
    }),
    DatabaseModule,
    ProductModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
