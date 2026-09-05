import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // `forRoot` configura só políticas comuns. Não existe mais adapter default
    // implícito — quem determina o adapter é a source, e `adapter` aqui passou
    // a ser **rejeitado** na inicialização com `SOURCE_CONFIGURATION_INVALID`.
    // `operators` também saiu: a restrição de operadores agora é por campo,
    // nas regras do endpoint.
    DynamicQueryBuilderModule.forRoot({
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 100,
      },
      // `portable-strict` é o perfil que faz `ilike` e `search` usarem coluna
      // dobrada em vez de `mode: 'insensitive'` do Prisma. É o que dá o mesmo
      // resultado em PostgreSQL, MySQL e SQL Server.
      textProfile: 'portable-strict',
    }),
    PrismaModule,
    UsersModule,
    CompaniesModule,
    PostsModule,
  ],
})
export class AppModule {}
