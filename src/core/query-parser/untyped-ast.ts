export interface UntypedFilterTerm {
  readonly path: string;
  readonly operator: string;
  readonly rawValue: unknown;
}

export interface UntypedSortTerm {
  readonly path: string;
  readonly direction: 'asc' | 'desc';
}

export interface UntypedPagination {
  readonly page: unknown;
  readonly perPage: unknown;
  readonly paginate: unknown;
}

/**
 * Forma canônica da query, ainda sem schema, sem regras e sem tipos de ORM.
 * O parser dá forma; quem dá significado é a autorização e o validador.
 */
export interface UntypedQueryAst {
  readonly filters: readonly UntypedFilterTerm[];
  readonly sorts: readonly UntypedSortTerm[];
  /** `null` = parâmetro ausente; `[]` = presente e vazio. */
  readonly fields: readonly string[] | null;
  readonly includes: readonly string[];
  readonly search: string | null;
  readonly pagination: UntypedPagination;
}
