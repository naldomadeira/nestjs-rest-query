export interface QueryResult<T> {
  data: T[];
  page?: number;
  perPage?: number;
  total?: number;
  lastPage?: number;
}
