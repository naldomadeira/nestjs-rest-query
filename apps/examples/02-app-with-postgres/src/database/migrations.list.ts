import { CreateUsersTable1731112260000 } from './migrations/1731112260000-CreateUsersTable';
import { CreateCompaniesTable1731112260001 } from './migrations/1731112260001-CreateCompaniesTable';
import { CreateModulesTable1731112260002 } from './migrations/1731112260002-CreateModulesTable';
import { CreateAccessRequestsTable1731112260003 } from './migrations/1731112260003-CreateAccessRequestsTable';
import { AddFoldedColumns1731112260004 } from './migrations/1731112260004-AddFoldedColumns';
import { SeedSampleData1731112260005 } from './migrations/1731112260005-SeedSampleData';

/**
 * Ordem de aplicação das migrations, explícita.
 *
 * A lista existe por dois motivos: o glob de arquivos não sobrevive ao ESM
 * (ver `database.module.ts`), e a ordem deixa de depender de ordenação de nomes
 * de arquivo pelo sistema de arquivos — o que importa aqui, porque a migration
 * de seed pressupõe as colunas dobradas já criadas.
 */
export const MIGRATIONS = [
  CreateUsersTable1731112260000,
  CreateCompaniesTable1731112260001,
  CreateModulesTable1731112260002,
  CreateAccessRequestsTable1731112260003,
  AddFoldedColumns1731112260004,
  SeedSampleData1731112260005,
];
