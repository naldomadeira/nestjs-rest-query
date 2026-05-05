import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule, PrismaAdapter } from 'nestjs-rest-query';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      adapter: new PrismaAdapter(),
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 100,
      },
    }),
    PrismaModule,
    UsersModule,
    CompaniesModule,
    PostsModule,
  ],
})
export class AppModule {}
