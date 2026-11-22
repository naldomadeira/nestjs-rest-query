---
'nestjs-rest-query': major
---

Closes consumer report #7. Error bodies carry `error` (`"Bad Request"` / `"Internal Server Error"`) like every Nest `HttpException`. A `500` no longer returns its message and `details` by default — only `code` and a generic message — and the full error goes to the configured logger even with logging disabled; `forRoot({ errors: { exposeInternalDetails: true } })` restores it, and `toHttpException(error, options)` takes the same option. A source created per request no longer rebuilds and re-validates its schema: the TypeORM and Drizzle adapters memoize it and the service skips an already-validated (rules, schema) pair. Swagger documents the operators of each filter field instead of the endpoint's union. `normalizeResult` and `normalizeRows` are exported, to build the response envelope from rows fetched elsewhere after `buildPlan`.
