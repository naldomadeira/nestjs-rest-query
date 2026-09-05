import { MigrationInterface, QueryRunner } from 'typeorm';
import { foldText } from 'nestjs-rest-query';

/**
 * Massa determinística de exemplo.
 *
 * Os seeds com faker (`pnpm seed:full`) continuam existindo para explorar a
 * API à mão. Esta migration é outra coisa: é o mínimo estável sobre o qual o
 * smoke E2E pode afirmar totais e nomes. A dobra é escrita com o `foldText`
 * exportado pela biblioteca — a mesma função que o núcleo aplica ao termo da
 * busca.
 */

interface CompanySeed {
  readonly cnpj: string;
  readonly name: string;
}

interface ModuleSeed {
  readonly name: string;
  readonly slug: string;
  readonly status: 'active' | 'inactive';
  readonly icon: string;
}

interface UserSeed {
  readonly ssoUserId: string;
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly document: string;
}

const COMPANIES: readonly CompanySeed[] = [
  { cnpj: '11.111.111/0001-11', name: 'Multilaser Indústria' },
  { cnpj: '22.222.222/0001-22', name: 'Multitech Serviços' },
  { cnpj: '33.333.333/0001-33', name: 'Comércio Elétrico Ltda' },
  { cnpj: '44.444.444/0001-44', name: 'Distribuidora Atlântico' },
];

const MODULES: readonly ModuleSeed[] = [
  {
    name: 'Boletos',
    slug: 'boletos',
    status: 'active',
    icon: 'material-symbols:receipt-long',
  },
  {
    name: 'Devoluções',
    slug: 'devolucoes',
    status: 'active',
    icon: 'material-symbols:assignment-return',
  },
  {
    name: 'Relatórios',
    slug: 'relatorios',
    status: 'active',
    icon: 'material-symbols:bar-chart',
  },
  {
    name: 'Suporte',
    slug: 'suporte',
    status: 'inactive',
    icon: 'material-symbols:support-agent',
  },
];

const USERS: readonly UserSeed[] = [
  {
    ssoUserId: 'c6e20fb9-7132-4c29-bc9a-7026281707e6',
    username: 'admin.system',
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@multitech.com.br',
    document: '00000000000',
  },
  {
    ssoUserId: '4a1c1d2e-0001-4c29-bc9a-702628170001',
    username: 'antonio.silva',
    firstName: 'Antônio',
    lastName: 'Silva',
    email: 'antonio.silva@multitech.com.br',
    document: '00000000001',
  },
  {
    ssoUserId: '4a1c1d2e-0002-4c29-bc9a-702628170002',
    username: 'cecilia.moraes',
    firstName: 'Cecília',
    lastName: 'Moraes',
    email: 'cecilia.moraes@multitech.com.br',
    document: '00000000002',
  },
  {
    ssoUserId: '4a1c1d2e-0003-4c29-bc9a-702628170003',
    username: 'bruno.almeida',
    firstName: 'Bruno',
    lastName: 'Almeida',
    email: 'bruno.almeida@empresa.com.br',
    document: '00000000003',
  },
  {
    ssoUserId: '4a1c1d2e-0004-4c29-bc9a-702628170004',
    username: 'daniela.rocha',
    firstName: 'Daniela',
    lastName: 'Rocha',
    email: 'daniela.rocha@empresa.com.br',
    document: '00000000004',
  },
  {
    ssoUserId: '4a1c1d2e-0005-4c29-bc9a-702628170005',
    username: 'eduardo.pinto',
    firstName: 'Eduardo',
    lastName: 'Pinto',
    email: 'eduardo.pinto@gmail.com',
    document: '00000000005',
  },
  {
    ssoUserId: '4a1c1d2e-0006-4c29-bc9a-702628170006',
    username: 'fernanda.dias',
    firstName: 'Fernanda',
    lastName: 'Dias',
    email: 'fernanda.dias@gmail.com',
    document: '00000000006',
  },
  {
    ssoUserId: '4a1c1d2e-0007-4c29-bc9a-702628170007',
    username: 'gustavo.lima',
    firstName: 'Gustavo',
    lastName: 'Lima',
    email: 'gustavo.lima@gmail.com',
    document: '00000000007',
  },
  {
    ssoUserId: '4a1c1d2e-0008-4c29-bc9a-702628170008',
    username: 'helena.castro',
    firstName: 'Helena',
    lastName: 'Castro',
    email: 'helena.castro@gmail.com',
    document: '00000000008',
  },
  {
    ssoUserId: '4a1c1d2e-0009-4c29-bc9a-702628170009',
    username: 'igor.tavares',
    firstName: 'Igor',
    lastName: 'Tavares',
    email: 'igor.tavares@gmail.com',
    document: '00000000009',
  },
  {
    ssoUserId: '4a1c1d2e-0010-4c29-bc9a-702628170010',
    username: 'julia.nogueira',
    firstName: 'Júlia',
    lastName: 'Nogueira',
    email: 'julia.nogueira@gmail.com',
    document: '00000000010',
  },
  {
    ssoUserId: '4a1c1d2e-0011-4c29-bc9a-702628170011',
    username: 'lucas.antunes',
    firstName: 'Lucas',
    lastName: 'Antunes',
    email: 'lucas.antunes@gmail.com',
    document: '00000000011',
  },
];

const OVERALL_STATUSES = ['pending', 'approved', 'rejected'] as const;
const ITEM_STATUSES = ['pending', 'approved', 'rejected'] as const;

export class SeedSampleData1731112260005 implements MigrationInterface {
  name = 'SeedSampleData1731112260005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const company of COMPANIES) {
      await queryRunner.query(
        `INSERT INTO "companies" ("cnpj", "name", "name_folded")
         VALUES ($1, $2, $3)
         ON CONFLICT ("cnpj") DO NOTHING`,
        [company.cnpj, company.name, foldText(company.name)],
      );
    }

    for (const entry of MODULES) {
      await queryRunner.query(
        `INSERT INTO "modules" ("name", "name_folded", "slug", "status", "icon")
         VALUES ($1, $2, $3, $4::"public"."modules_status_enum", $5)
         ON CONFLICT ("slug") DO NOTHING`,
        [
          entry.name,
          foldText(entry.name),
          entry.slug,
          entry.status,
          entry.icon,
        ],
      );
    }

    for (const user of USERS) {
      await queryRunner.query(
        `INSERT INTO "users"
           ("sso_user_id", "username", "first_name", "first_name_folded",
            "last_name", "email", "email_folded", "document")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("sso_user_id") DO NOTHING`,
        [
          user.ssoUserId,
          user.username,
          user.firstName,
          foldText(user.firstName),
          user.lastName,
          user.email,
          foldText(user.email),
          user.document,
        ],
      );
    }

    const userIds = await ids(queryRunner, 'users');
    const companyIds = await ids(queryRunner, 'companies');
    const moduleIds = await ids(queryRunner, 'modules');

    // Duas solicitações por usuário, com combinação estável de empresa e
    // módulo: nada aqui depende de sorteio, então o E2E pode afirmar totais.
    let sequence = 0;
    for (const userId of userIds) {
      for (let round = 0; round < 2; round++) {
        const overall = OVERALL_STATUSES[sequence % OVERALL_STATUSES.length];
        const [request]: Array<{ id: number }> = await queryRunner.query(
          `INSERT INTO "access_requests" ("user_id", "overall_status")
           VALUES ($1, $2) RETURNING "id"`,
          [userId, overall],
        );

        const itemCount = 1 + (sequence % 2);
        for (let i = 0; i < itemCount; i++) {
          const companyId = companyIds[(sequence + i) % companyIds.length];
          const moduleId = moduleIds[(sequence + i) % moduleIds.length];
          const status = ITEM_STATUSES[(sequence + i) % ITEM_STATUSES.length];

          await queryRunner.query(
            `INSERT INTO "access_request_items"
               ("access_request_id", "company_id", "module_id", "status")
             VALUES ($1, $2, $3, $4)`,
            [request.id, companyId, moduleId, status],
          );
        }

        sequence++;
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "access_request_items"`);
    await queryRunner.query(`DELETE FROM "access_requests"`);
    await queryRunner.query(`DELETE FROM "users"`);
    await queryRunner.query(`DELETE FROM "modules"`);
    await queryRunner.query(`DELETE FROM "companies"`);
  }
}

async function ids(queryRunner: QueryRunner, table: string): Promise<number[]> {
  const rows: Array<{ id: number }> = await queryRunner.query(
    `SELECT "id" FROM "${table}" ORDER BY "id" ASC`,
  );
  return rows.map((row) => row.id);
}
