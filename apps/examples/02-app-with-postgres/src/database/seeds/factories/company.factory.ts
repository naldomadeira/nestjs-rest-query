import { fakerPT_BR as faker } from '@faker-js/faker';
import { Company } from '../../../companies/entities/company.entity';
import { formatCnpj } from '../utils/seed.helpers';

/**
 * Gera um objeto Company com dados fictícios usando faker pt_BR.
 * CNPJ gerado aleatoriamente e formatado (fictício, não válido).
 */
export function makeCompany(
  overrides: Partial<Company> = {},
): Partial<Company> {
  return {
    cnpj: formatCnpj(
      faker.string.numeric({ length: 14, allowLeadingZeros: true }),
    ),
    name: faker.company.name(),
    ...overrides,
  };
}

/**
 * Gera N objetos Company com dados fictícios.
 */
export function makeCompanies(count: number): Partial<Company>[] {
  return Array.from({ length: count }, () => makeCompany());
}
