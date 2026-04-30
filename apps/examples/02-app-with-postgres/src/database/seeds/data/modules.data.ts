import { ModuleStatus } from '../../../modules/entities/module.entity';

export interface ModuleSeedData {
  name: string;
  slug: string;
  status: ModuleStatus;
  icon: string;
}

export const MODULES_SEED_DATA: ModuleSeedData[] = [
  {
    name: 'Boletos',
    slug: 'boletos',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:receipt-long',
  },
  {
    name: 'Devoluções',
    slug: 'devolucoes',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:assignment-return',
  },
  {
    name: 'Ajuda',
    slug: 'ajuda',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:help',
  },
  {
    name: 'Mercury',
    slug: 'mercury',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:analytics',
  },
  {
    name: 'Sales',
    slug: 'sales',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:trending-up',
  },
  {
    name: 'Marketing',
    slug: 'marketing',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:campaign',
  },
  {
    name: 'Relatórios',
    slug: 'relatorios',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:bar-chart',
  },
  {
    name: 'Cadastros',
    slug: 'cadastros',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:manage-accounts',
  },
  {
    name: 'Financeiro',
    slug: 'financeiro',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:account-balance',
  },
  {
    name: 'RH',
    slug: 'rh',
    status: ModuleStatus.INACTIVE,
    icon: 'material-symbols:people',
  },
  {
    name: 'Estoque',
    slug: 'estoque',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:inventory-2',
  },
  {
    name: 'Suporte',
    slug: 'suporte',
    status: ModuleStatus.INACTIVE,
    icon: 'material-symbols:support-agent',
  },
];
