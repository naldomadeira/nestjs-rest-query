import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config();

export const datasource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  username: process.env.DB_USERNAME,
  migrations: [`src/database/migrations/*{.ts,.js}`],
  entities: [],
});
