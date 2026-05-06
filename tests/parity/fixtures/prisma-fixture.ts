/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prisma fixture: a synthetic PrismaSource bound to a fake delegate
 * that returns empty data without touching a real database.
 *
 * Schema mirrors the canonical user/company/posts model used by every
 * fixture in this folder.
 */

import type { PrismaSource } from '@contracts/prisma-source.interface';

export interface PrismaFixture {
  source: PrismaSource<any>;
  alias: string;
}

export function makePrismaFixture(): PrismaFixture {
  const delegate = {
    findMany: async () => [] as any[],
    count: async () => 0,
  };

  const prisma: any = { user: delegate };

  const source: PrismaSource<any> = {
    prisma,
    model: 'user',
    primaryKeyField: 'id',
    relations: {
      company: {
        cardinality: 'one',
      },
      posts: {
        cardinality: 'many',
        primaryKeyField: 'id',
      },
    },
  };

  return { source, alias: 'user' };
}
