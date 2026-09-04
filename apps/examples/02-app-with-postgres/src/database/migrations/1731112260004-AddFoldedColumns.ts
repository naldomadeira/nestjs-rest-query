import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Colunas dobradas do perfil `portable-strict`.
 *
 * Sob esse perfil `ilike` e `search` não comparam a coluna original com
 * `ILIKE`: comparam uma coluna já normalizada com o termo normalizado pela
 * mesma função. É o que faz a mesma requisição devolver o mesmo conjunto em
 * PostgreSQL, MySQL e SQL Server, sem depender da collation do servidor.
 *
 * O nome de cada coluna segue a convenção que o adapter do TypeORM reconhece:
 * `<path do campo>_folded`, sobre o path lógico (a propriedade da entidade),
 * não sobre o nome físico.
 */
export class AddFoldedColumns1731112260004 implements MigrationInterface {
  name = 'AddFoldedColumns1731112260004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "first_name_folded" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "email_folded" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD COLUMN "name_folded" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "modules" ADD COLUMN "name_folded" character varying(100) NOT NULL DEFAULT ''`,
    );

    // Backfill de linhas já existentes. `lower()` do PostgreSQL coincide com
    // `foldText` para os dados deste exemplo; a partir daqui quem mantém as
    // colunas é o listener da entidade, que usa a função exportada pela
    // biblioteca.
    await queryRunner.query(
      `UPDATE "users" SET "first_name_folded" = lower("first_name"), "email_folded" = lower("email")`,
    );
    await queryRunner.query(
      `UPDATE "companies" SET "name_folded" = lower(coalesce("name", ''))`,
    );
    await queryRunner.query(
      `UPDATE "modules" SET "name_folded" = lower("name")`,
    );

    // Índices sobre a coluna dobrada: a busca vira igualdade/prefixo sobre um
    // valor literal, então é indexável — ao contrário de `ILIKE` sobre a
    // coluna original.
    await queryRunner.query(
      `CREATE INDEX "IDX_users_first_name_folded" ON "users" ("first_name_folded")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email_folded" ON "users" ("email_folded")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_companies_name_folded" ON "companies" ("name_folded")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_modules_name_folded" ON "modules" ("name_folded")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_modules_name_folded"`);
    await queryRunner.query(`DROP INDEX "IDX_companies_name_folded"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email_folded"`);
    await queryRunner.query(`DROP INDEX "IDX_users_first_name_folded"`);
    await queryRunner.query(`ALTER TABLE "modules" DROP COLUMN "name_folded"`);
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "name_folded"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_folded"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "first_name_folded"`,
    );
  }
}
