/* eslint-disable @typescript-eslint/no-explicit-any */
import { QueryOperator } from './operator.types';
import { SelectQueryBuilder } from 'typeorm';

type Handler = (
  qb: SelectQueryBuilder<any>,
  alias: string,
  field: string,
  paramKey: string,
  value: any
) => void;

export const operatorRegistry: Record<QueryOperator, Handler> = {
  eq: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} = :${k}`, { [k]: v });
  },
  ne: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} != :${k}`, { [k]: v });
  },
  // Sempre aplica wildcard nos dois lados (%valor%). Para busca por prefixo
  // (valor%) use o operador startsWith, para sufixo (%valor) use endsWith.
  like: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} LIKE :${k}`, { [k]: `%${v}%` });
  },
  // Case-insensitive LIKE usando LOWER() para portabilidade entre bancos.
  // Postgres tem ILIKE nativo (mais performatico com indices), mas MySQL/SQLite nao.
  // Para Postgres com grandes volumes, prefira criar um indice funcional LOWER()
  // ou usar o customize() hook para ILIKE diretamente.
  ilike: (qb, alias, field, k, v) => {
    qb.andWhere(`LOWER(${alias}.${field}) LIKE LOWER(:${k})`, {
      [k]: `%${v}%`,
    });
  },
  notLike: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} NOT LIKE :${k}`, { [k]: `%${v}%` });
  },
  // Veja comentario de ilike acima — mesma logica de portabilidade.
  notIlike: (qb, alias, field, k, v) => {
    qb.andWhere(`LOWER(${alias}.${field}) NOT LIKE LOWER(:${k})`, {
      [k]: `%${v}%`,
    });
  },
  gt: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} > :${k}`, { [k]: v });
  },
  gte: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} >= :${k}`, { [k]: v });
  },
  lt: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} < :${k}`, { [k]: v });
  },
  lte: (qb, alias, field, k, v) => {
    qb.andWhere(`${alias}.${field} <= :${k}`, { [k]: v });
  },
  in: (qb, alias, field, k, v: any[]) => {
    qb.andWhere(`${alias}.${field} IN (:...${k})`, { [k]: v });
  },
  notIn: (qb, alias, field, k, v: any[]) => {
    qb.andWhere(`${alias}.${field} NOT IN (:...${k})`, { [k]: v });
  },
  between: (qb, alias, field, k, v: [any, any]) => {
    qb.andWhere(`${alias}.${field} BETWEEN :${k}_start AND :${k}_end`, {
      [`${k}_start`]: v[0],
      [`${k}_end`]: v[1],
    });
  },
  isNull: (qb, alias, field, _k, isNull: boolean) => {
    if (isNull) qb.andWhere(`${alias}.${field} IS NULL`);
    else qb.andWhere(`${alias}.${field} IS NOT NULL`);
  },
};
