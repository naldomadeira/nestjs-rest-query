// Exports internos — NÃO são API pública
export { applyFilters } from './handlers/filters.handler';
export { applyIncludes } from './handlers/includes.handler';
export { applySorts } from './handlers/sorts.handler';
export { applyFields } from './handlers/fields.handler';
export { applyPagination } from './handlers/pagination.handler';
export { operatorRegistry } from './operators/operator.registry';
export { Operator } from './operators/operator.types';
export type { QueryOperator } from './operators/operator.types';
