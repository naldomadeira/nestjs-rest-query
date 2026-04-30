import { fakerPT_BR as faker } from '@faker-js/faker';
import { AccessRequest } from '../../../access-requests/entities/access-request.entity';
import { AccessRequestItem } from '../../../access-requests/entities/access-request-item.entity';
import { Company } from '../../../companies/entities/company.entity';
import { Module } from '../../../modules/entities/module.entity';
import { User } from '../../../users/entities/user.entity';
import { pickRandom, pickRandomMany, randomInt } from '../utils/seed.helpers';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';
export type AccessRequestItemStatus = 'pending' | 'approved' | 'rejected';

// Distribuição de statuses: 40% pending, 35% approved, 25% rejected
const STATUS_DISTRIBUTION: AccessRequestStatus[] = [
  'pending',
  'pending',
  'pending',
  'pending',
  'approved',
  'approved',
  'approved',
  'rejected',
  'rejected',
];

// ─── Item Factory ─────────────────────────────────────────────────────────────

export function makeAccessRequestItem(
  company: Company,
  module: Module,
  parentStatus: AccessRequestStatus,
  overrides: Partial<AccessRequestItem> = {},
): Partial<AccessRequestItem> {
  const isEvaluated = parentStatus !== 'pending';

  let itemStatus: AccessRequestItemStatus;
  if (parentStatus === 'approved') {
    itemStatus = 'approved';
  } else if (parentStatus === 'rejected') {
    itemStatus = 'rejected';
  } else {
    itemStatus = 'pending';
  }

  return {
    companyId: company.id,
    moduleId: module.id,
    status: itemStatus,
    evaluatedBy: isEvaluated ? faker.person.fullName() : null,
    evaluatedAt: isEvaluated ? faker.date.recent({ days: 30 }) : null,
    reason:
      itemStatus === 'rejected'
        ? faker.lorem.sentence({ min: 5, max: 15 })
        : null,
    ...overrides,
  };
}

// ─── AccessRequest Factory ───────────────────────────────────────────────────

export interface MakeAccessRequestOptions {
  user: User;
  companies: Company[];
  modules: Module[];
  status?: AccessRequestStatus;
  itemCount?: number;
}

export function makeAccessRequest({
  user,
  companies,
  modules,
  status,
  itemCount,
}: MakeAccessRequestOptions): Partial<AccessRequest> & {
  items: Partial<AccessRequestItem>[];
} {
  const overallStatus: AccessRequestStatus =
    status ?? pickRandom(STATUS_DISTRIBUTION);

  const numItems = itemCount ?? randomInt(1, Math.min(3, companies.length));
  const selectedCompanies = pickRandomMany(companies, numItems);
  const selectedModules = pickRandomMany(
    modules,
    randomInt(1, Math.min(3, modules.length)),
  );

  // Cada item combina uma empresa com um ou mais módulos
  const items: Partial<AccessRequestItem>[] = [];
  for (const company of selectedCompanies) {
    const module = pickRandom(selectedModules);
    items.push(makeAccessRequestItem(company, module, overallStatus));
  }

  return {
    userId: user.id,
    overallStatus,
    items: items as AccessRequestItem[],
  };
}

// ─── Variações de AccessRequests ─────────────────────────────────────────────

/** Cria N access requests com statuses variados para um usuário */
export function makeAccessRequestsForUser(
  user: User,
  companies: Company[],
  modules: Module[],
  count = 2,
): Array<Partial<AccessRequest> & { items: Partial<AccessRequestItem>[] }> {
  return Array.from({ length: count }, () =>
    makeAccessRequest({ user, companies, modules }),
  );
}

/** Cria um access request totalmente aprovado */
export function makeApprovedAccessRequest(
  user: User,
  companies: Company[],
  modules: Module[],
): Partial<AccessRequest> & { items: Partial<AccessRequestItem>[] } {
  return makeAccessRequest({ user, companies, modules, status: 'approved' });
}

/** Cria um access request totalmente rejeitado */
export function makeRejectedAccessRequest(
  user: User,
  companies: Company[],
  modules: Module[],
): Partial<AccessRequest> & { items: Partial<AccessRequestItem>[] } {
  return makeAccessRequest({ user, companies, modules, status: 'rejected' });
}

/** Cria um access request pendente (sem avaliação) */
export function makePendingAccessRequest(
  user: User,
  companies: Company[],
  modules: Module[],
): Partial<AccessRequest> & { items: Partial<AccessRequestItem>[] } {
  return makeAccessRequest({ user, companies, modules, status: 'pending' });
}
