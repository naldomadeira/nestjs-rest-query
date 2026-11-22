---
'nestjs-rest-query': major
---

Request limits in the core: `forRoot({ limits })` and `defineQueryRules(..., { limits })` bound the number of filter terms (default 20), `in`/`notIn`/`between` items (100), sort fields (5), `search` length (100) and each string filter value (255). Past any of them the request is `400 QUERY_LIMIT_EXCEEDED`, checked before authorization. `pagination.maxPerPage` defaults to `100` again (it was `500` in alpha.1 and alpha.2). A grammar key that arrives unparsed (`filter[name][eq]` from Fastify's or Express 5's flat query parser) is still `QUERY_SYNTAX_UNKNOWN_PARAM`, now with a message naming the cause and `details.hint: "nested-query-parser-required"`.
