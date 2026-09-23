---
'nestjs-rest-query': patch
---

fix(swagger): make `dqbSwaggerRequestInterceptor` self-contained (consumer report #3)

`@nestjs/swagger` writes `swaggerOptions.requestInterceptor` into `swagger-ui-init.js` with `fn.toString()`, and the browser runs that text with none of this package in scope. The interceptor returned by `dqbSwaggerRequestInterceptor(document)` was a closure over module helpers, so every Swagger UI "Try it out" failed with `ReferenceError: interceptSwaggerRequest is not defined`.

Both forms — `dqbSwaggerRequestInterceptor(document)` and passing `dqbSwaggerRequestInterceptor` directly — are now self-contained; the marked routes travel inside the function source as a literal. The form field also accepts several filter expressions joined by `&`. No consumer change required; drop any local replacement you added as a workaround.
