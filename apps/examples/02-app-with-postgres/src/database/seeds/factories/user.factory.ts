import { fakerPT_BR as faker } from '@faker-js/faker';
import { User } from '../../../users/entities/user.entity';

/**
 * Gera um objeto User com dados fictícios usando faker pt_BR.
 * Simula usuários vindos do Keycloak (ssoUserId como UUID).
 */
export function makeUser(overrides: Partial<User> = {}): Partial<User> {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const username = `${firstName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}.${lastName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')}.${faker.string.alphanumeric(4)}`;

  return {
    ssoUserId: faker.string.uuid(),
    username,
    firstName,
    lastName,
    email: faker.internet.email({
      firstName,
      lastName,
      provider: 'multitech.com.br',
    }),
    document: faker.string.numeric({ length: 11, allowLeadingZeros: true }),
    photoUrl:
      faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.6 }) ??
      null,
    ...overrides,
  };
}

/**
 * Gera N objetos User com dados fictícios.
 */
export function makeUsers(count: number): Partial<User>[] {
  return Array.from({ length: count }, () => makeUser());
}

// ─── Variações pré-definidas de usuários ────────────────────────────────────

/** Usuário admin com dados fixos para testes */
export function makeAdminUser(): Partial<User> {
  return {
    ssoUserId: 'c6e20fb9-7132-4c29-bc9a-7026281707e6',
    username: 'admin.system',
    firstName: 'Admin',
    lastName: 'System',
    email: 'admin@multitech.com.br',
    document: '00000000000',
    photoUrl: null,
  };
}

/** Usuário gestor de empresa */
export function makeManagerUser(overrides: Partial<User> = {}): Partial<User> {
  return makeUser({
    email: faker.internet.email({ provider: 'empresa.com.br' }),
    ...overrides,
  });
}

/** Usuário externo / cliente */
export function makeExternalUser(overrides: Partial<User> = {}): Partial<User> {
  return makeUser({
    email: faker.internet.email({ provider: 'gmail.com' }),
    photoUrl: null,
    ...overrides,
  });
}
