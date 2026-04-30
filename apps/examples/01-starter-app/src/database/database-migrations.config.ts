import { DataSource } from 'typeorm';
import { config } from 'dotenv';
config();

export const dataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  entities: [`${__dirname}/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  logging: process.env.LOG_LEVEL === 'debug',
  synchronize: true, //development only
});
