import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config();

export const dataSource = new DataSource({
  // O TypeORM 1.x removeu o driver `sqlite` em favor de `better-sqlite3`.
  type: 'better-sqlite3',
  database: 'database.sqlite',
  entities: [`${__dirname}/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  logging: process.env.LOG_LEVEL === 'debug',
  synchronize: true, //development only
});
