/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Interface para receber query params do NestJS @Query() decorator
 *
 * Exemplos de entrada:
 * - { filter: { name: { eq: 'Product' } } }
 * - { fields: 'id,name,price' }
 * - { sort: '-name' }
 * - { includes: 'category' }
 * - { search: 'acme' }
 * - { page: '1', perPage: '10' }
 */
export interface QueryInput {
  page?: string | number;

  perPage?: string | number;

  paginate?: string | boolean;

  sort?: string;

  fields?: string;

  includes?: string;

  filter?: Record<string, Record<string, any> | any>;

  search?: string;

  [key: string]: any;
}
