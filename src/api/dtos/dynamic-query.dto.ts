/* eslint-disable @typescript-eslint/no-explicit-any */

export class DynamicQueryDto {
  page?: string;

  perPage?: string;

  paginate?: string;

  sort?: string;

  fields?: string;

  includes?: string;

  filter?: Record<string, Record<string, any> | any>;

  search?: string;
}

export type PaginationQueryDto = Pick<
  DynamicQueryDto,
  'page' | 'perPage' | 'paginate'
>;
