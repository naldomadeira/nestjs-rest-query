import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccessRequestsTable1731112260003 implements MigrationInterface {
  name = 'CreateAccessRequestsTable1731112260003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // access_requests — tabela principal (1 por solicitação de usuário)
    await queryRunner.query(`
      CREATE TABLE "access_requests" (
        "id" SERIAL NOT NULL,
        "user_id" INTEGER NOT NULL,
        "overall_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
        "deleted_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "access_requests"
      ADD CONSTRAINT "FK_access_requests_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_access_requests_user_id" ON "access_requests" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_requests_overall_status" ON "access_requests" ("overall_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_requests_created_at" ON "access_requests" ("created_at")`,
    );

    // access_request_items — itens granulares (empresa + módulo por solicitação)
    await queryRunner.query(`
      CREATE TABLE "access_request_items" (
        "id" SERIAL NOT NULL,
        "access_request_id" INTEGER NOT NULL,
        "company_id" INTEGER NOT NULL,
        "module_id" INTEGER NOT NULL,
        "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
        "evaluated_by" VARCHAR(255),
        "evaluated_at" TIMESTAMP,
        "reason" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_request_items_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "access_request_items"
      ADD CONSTRAINT "FK_access_request_items_access_request_id"
      FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "access_request_items"
      ADD CONSTRAINT "FK_access_request_items_company_id"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "access_request_items"
      ADD CONSTRAINT "FK_access_request_items_module_id"
      FOREIGN KEY ("module_id") REFERENCES "modules"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_access_request_items_access_request_id" ON "access_request_items" ("access_request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_request_items_company_id" ON "access_request_items" ("company_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_request_items_module_id" ON "access_request_items" ("module_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_access_request_items_status" ON "access_request_items" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_access_request_items_status"`);
    await queryRunner.query(`DROP INDEX "IDX_access_request_items_module_id"`);
    await queryRunner.query(`DROP INDEX "IDX_access_request_items_company_id"`);
    await queryRunner.query(
      `DROP INDEX "IDX_access_request_items_access_request_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_module_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_request_items" DROP CONSTRAINT "FK_access_request_items_access_request_id"`,
    );
    await queryRunner.query(`DROP TABLE "access_request_items"`);

    await queryRunner.query(`DROP INDEX "IDX_access_requests_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_access_requests_overall_status"`);
    await queryRunner.query(`DROP INDEX "IDX_access_requests_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "access_requests" DROP CONSTRAINT "FK_access_requests_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "access_requests"`);
  }
}
