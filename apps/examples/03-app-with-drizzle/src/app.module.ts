import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { PostsModule } from './posts/posts.module';
import { drizzleProvider } from './db/drizzle.provider';

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
    UsersModule,
    CompaniesModule,
    PostsModule,
  ],
  providers: [drizzleProvider],
})
export class AppModule {}
