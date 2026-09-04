import { Module, ModuleStatus } from '../entities/module.entity';

/**
 * Instância de `Module` para testes, com a coluna dobrada coerente.
 *
 * O mock não é mais um object literal: desde que a entidade ganhou
 * `name_folded` e o listener que a mantém, um literal não satisfaz mais o tipo
 * — e, pior, produziria um objeto cuja dobra não corresponde ao `name`. Passar
 * por `new Module()` + `foldSearchableColumns()` é o que garante que o mock
 * respeite a mesma invariante que o banco.
 */
export const mockModule = (overrides?: Partial<Module>): Module => {
  const entity = Object.assign(new Module(), {
    id: 1,
    name: 'Multi Boletos',
    slug: 'multi-boletos',
    status: ModuleStatus.ACTIVE,
    icon: 'material-symbols:apps',
    createdAt: new Date('2025-11-19T10:00:00.000Z'),
    updatedAt: new Date('2025-11-19T10:00:00.000Z'),
    ...overrides,
  });

  // Reaplica a dobra depois dos overrides: quem troca o `name` no teste não
  // precisa lembrar de trocar `name_folded`.
  if (overrides?.name_folded === undefined) entity.foldSearchableColumns();

  return entity;
};
