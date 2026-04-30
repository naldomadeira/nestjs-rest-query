import { Module, ModuleStatus } from '../entities/module.entity';

export const mockModule = (overrides?: Partial<Module>): Module => ({
  id: 1,
  name: 'Multi Boletos',
  slug: 'multi-boletos',
  status: ModuleStatus.ACTIVE,
  icon: 'material-symbols:apps',
  createdAt: new Date('2025-11-19T10:00:00.000Z'),
  updatedAt: new Date('2025-11-19T10:00:00.000Z'),
  ...overrides,
});
