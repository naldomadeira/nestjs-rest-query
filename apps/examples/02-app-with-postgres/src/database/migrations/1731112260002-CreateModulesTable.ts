import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateModulesTable1731112260002 implements MigrationInterface {
  name = 'CreateModulesTable1731112260002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."modules_status_enum" AS ENUM('active', 'inactive')`,
    );

    await queryRunner.query(
      `CREATE TABLE "modules" (
        "id" SERIAL NOT NULL,
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "status" "public"."modules_status_enum" NOT NULL DEFAULT 'active',
        "icon" character varying(100),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_modules_name" UNIQUE ("name"),
        CONSTRAINT "UQ_modules_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_modules_id" PRIMARY KEY ("id")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "modules"`);
    await queryRunner.query(`DROP TYPE "public"."modules_status_enum"`);
  }
}
