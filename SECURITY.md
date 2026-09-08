# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

Older internal versions (published as `@multitechbr/nestjs-dynamic-query-builder`) are not supported.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Email: **naldomadeira@gmail.com**

Include:

- Affected version(s)
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgement within 48 hours and a status update within 7 days. Coordinated disclosure timelines will be discussed case by case.

## Security model

`nestjs-rest-query` is whitelist-first: every filterable, sortable, selectable, includable, or searchable field must be explicitly declared per endpoint, in rules built with `defineQueryRules`. Anything not on the whitelist is **refused with `400`**, not ignored — including a query parameter outside the eight-key grammar, which is `QUERY_SYNTAX_UNKNOWN_PARAM`. Silently dropping input the caller asked for is how a filtered page becomes a wrong page.

Two properties of the `3.x` model are load-bearing for security, and both differ from `2.x`:

- **Paths are exact.** Authorizing `company` does not authorize `company.name`. In `2.x`, prefix matching meant authorizing a relation exposed every field on it — review your whitelists when upgrading, because they may have been granting more than you read them as granting.
- **Rules are validated at startup.** A path that does not exist, a default outside `allowed`, or an operator the field's type cannot support refuses to boot, instead of failing open or failing late.

This is the primary defense against unsafe field exposure. Consumers are responsible for:

- Keeping the endpoint rules minimal (least privilege).
- Not exposing internal columns (e.g. password hashes, internal flags) in `fields` or `sorts`.
- Layering authentication/authorization (e.g. NestJS guards) above the query builder.
- Validating tenant scoping on the controller before the query reaches the service.
