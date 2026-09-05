/**
 * Envelope da v2, mantido exportado só para não quebrar assinatura de método
 * de consumidor que ainda o anota.
 *
 * @deprecated Use `NormalizedQueryResult<T>`, que é o que `execute()` devolve
 * na v3. Os dois são estruturalmente idênticos, e é justamente esse o
 * problema: código v2 anotado com `QueryResult<T>` **compila sem erro** contra
 * a v3, então o consumidor conclui que o retorno não mudou. O que mudou não é
 * a forma do envelope — é o conteúdo (PK removida da projeção quando não
 * pedida, relação sempre aninhada, `total` contando roots). Este `@deprecated`
 * existe para que o editor diga isso na hora da migração, que é o único
 * momento em que alguém leria.
 */
export interface QueryResult<T> {
  data: T[];
  page?: number;
  perPage?: number;
  total?: number;
  lastPage?: number;
}
