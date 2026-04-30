import { config } from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

config({ path: path.resolve(process.cwd(), '.env') });

export const seedDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  username: process.env.DB_USERNAME,
  ssl: false,
  entities: [path.join(__dirname, '/../../**/*.entity{.ts,.js}')],
  logging: process.env.LOG_LEVEL === 'debug',
});
