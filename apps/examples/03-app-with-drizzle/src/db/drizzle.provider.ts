import { Provider } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE_INSTANCE = Symbol('DRIZZLE_INSTANCE');

export const drizzleProvider: Provider = {
  provide: DRIZZLE_INSTANCE,
  useFactory: async () => {
    const client = postgres(
      `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5433}/${process.env.DB_NAME || 'app_db_drizzle'}`
    );

    return drizzle(client, { schema });
  },
};
