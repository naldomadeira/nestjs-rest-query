import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompaniesTable1731112260001 implements MigrationInterface {
  name = 'CreateCompaniesTable1731112260001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" SERIAL NOT NULL, "uuid" UUID NOT NULL DEFAULT gen_random_uuid(), "cnpj" character varying(18) NOT NULL, "name" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_companies_uuid" UNIQUE ("uuid"), CONSTRAINT "UQ_companies_cnpj" UNIQUE ("cnpj"), CONSTRAINT "PK_companies_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "companies"`);
  }
}
