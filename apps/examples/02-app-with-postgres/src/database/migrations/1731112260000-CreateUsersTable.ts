import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1731112260000 implements MigrationInterface {
  name = 'CreateUsersTable1731112260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "sso_user_id" character varying(255) NOT NULL, "username" character varying(64) NOT NULL, "first_name" character varying(255) NOT NULL, "last_name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "document" character varying(14) NOT NULL, "photo_url" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_users_sso_user_id" UNIQUE ("sso_user_id"), CONSTRAINT "UQ_users_username" UNIQUE ("username"), CONSTRAINT "UQ_users_email" UNIQUE ("email"), CONSTRAINT "UQ_users_document" UNIQUE ("document"), CONSTRAINT "PK_users_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
