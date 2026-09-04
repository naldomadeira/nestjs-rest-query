import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Category } from '../product/entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { SeedProductsAndCategory1756384597273 } from './migrations/1756384597273-SeedProductsAndCategory';
config();

export const dataSource = new DataSource({
  // O TypeORM 1.x removeu o driver `sqlite` em favor de `better-sqlite3`.
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH ?? 'database.sqlite',
  entities: [Product, Category],
  migrations: [SeedProductsAndCategory1756384597273],
  logging: process.env.LOG_LEVEL === 'debug',
  synchronize: true, //development only
});
