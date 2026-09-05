import { Module } from '@nestjs/common';
import { DynamicQueryBuilderModule } from 'nestjs-rest-query';
import { DatabaseModule } from './db/database.module';
import { CompaniesModule } from './companies/companies.module';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';

/**
 * `forRoot` configura só políticas comuns.
 *
 * Não existe mais `adapter` aqui: quem determina o adapter é a source que o
 * serviço monta, e passar `adapter` ou `operators` neste objeto é rejeitado na
 * inicialização com `SOURCE_CONFIGURATION_INVALID`. Restrição de operador
 * agora é por campo, nas regras do endpoint.
 *
 * `textProfile: 'portable-strict'` é o que faz `search`/`ilike` consultarem a
 * coluna dobrada em vez de `ILIKE`. É também o default, mas declarar deixa
 * explícito de onde vem o contrato das colunas `*Folded`.
 */
@Module({
  imports: [
    DynamicQueryBuilderModule.forRoot({
      pagination: {
        defaultPerPage: 10,
        maxPerPage: 100,
      },
      textProfile: 'portable-strict',
      consistency: 'eventual',
      logging: { enabled: true, level: 'warn', redactValues: true },
    }),
    DatabaseModule,
    CompaniesModule,
    UsersModule,
    PostsModule,
  ],
})
export class AppModule {}
